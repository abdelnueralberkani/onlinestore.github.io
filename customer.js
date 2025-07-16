class CustomerShop {
  constructor() {
    this.products = [];
    this.cart = {};
    this.commissionRate = 0.04; // القيمة الافتراضية، سيتم جلبها من الإعدادات
    this.loadCommission();
    this.init();
  }

  async loadCommission() {
    const doc = await db.collection('settings').doc('commission').get();
    if (doc.exists) {
      this.commissionRate = doc.data().rate || 0.04;
    }
  }

  async init() {
    await this.loadProducts();
    this.renderCart();
    document.getElementById('btn-place-order').addEventListener('click', () => this.placeOrder());
  }

  async loadProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = '<p>جارٍ تحميل المنتجات...</p>';
    const snapshot = await db.collection('products').get();
    this.products = [];
    if (snapshot.empty) {
      container.innerHTML = '<p>لا توجد منتجات متاحة حالياً.</p>';
      return;
    }
    container.innerHTML = '';
    snapshot.forEach(doc => {
      const product = doc.data();
      product.id = doc.id;
      this.products.push(product);
      container.innerHTML += `
        <div class="product-item" data-id="${doc.id}">
          <h3>${product.name} (${product.storeName || 'متجر غير معروف'})</h3>
          <p>السعر: ${product.price} ريال</p>
          <p>الكمية المتوفرة: ${product.quantity}</p>
          <input type="number" min="1" max="${product.quantity}" value="1" class="quantity-input" />
          <button class="btn-add-to-cart" ${product.quantity === 0 ? 'disabled' : ''}>
            ${product.quantity === 0 ? 'غير متوفر' : 'أضف إلى السلة'}
          </button>
        </div>`;
    });
    this.bindAddButtons();
  }

  bindAddButtons() {
    document.querySelectorAll('.btn-add-to-cart').forEach(button => {
      button.addEventListener('click', e => {
        const productElem = e.target.closest('.product-item');
        const id = productElem.dataset.id;
        const qtyInput = productElem.querySelector('.quantity-input');
        let qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty < 1) qty = 1;
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        if (qty > product.quantity) {
          alert('الكمية المطلوبة أكبر من المتوفرة.');
          return;
        }
        if (this.cart[id]) {
          if (this.cart[id].quantity + qty > product.quantity) {
            alert('إجمالي الكمية في السلة أكبر من المتوفرة.');
            return;
          }
          this.cart[id].quantity += qty;
        } else {
          this.cart[id] = {
            product,
            quantity: qty,
          };
        }
        this.renderCart();
      });
    });
  }

  renderCart() {
    const container = document.getElementById('cart-container');
    if (Object.keys(this.cart).length === 0) {
      container.innerHTML = '<p>السلة فارغة.</p>';
      document.getElementById('btn-place-order').disabled = true;
      return;
    }
    let html = `<table border="1" cellpadding="5" cellspacing="0" style="width: 100%; text-align: center;">
      <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th>إزالة</th></tr></thead><tbody>`;
    let total = 0;
    Object.values(this.cart).forEach(item => {
      const subTotal = item.product.price * item.quantity;
      total += subTotal;
      html += `
      <tr data-id="${item.product.id}">
        <td>${item.product.name}</td>
        <td>${item.quantity}</td>
        <td>${item.product.price.toFixed(2)}</td>
        <td>${subTotal.toFixed(2)}</td>
        <td><button class="btn-remove-item" data-id="${item.product.id}">حذف</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    html += `<p>الإجمالي (بدون الخصم): ${total.toFixed(2)} ريال</p>`;
    const adminFee = total * this.commissionRate;
    const surcharge = Object.values(this.cart).reduce((acc, item) => acc + (item.quantity * 2000), 0);
    const finalTotal = total + adminFee + surcharge;
    html += `<p>خصم المدير (${(this.commissionRate * 100).toFixed(2)}%): ${adminFee.toFixed(2)} ريال</p>`;
    html += `<p>رسوم ثابتة: ${surcharge} ريال</p>`;
    html += `<p>المجموع النهائي: ${finalTotal.toFixed(2)} ريال</p>`;
    container.innerHTML = html;
    this.bindRemoveButtons();
    document.getElementById('btn-place-order').disabled = false;
  }

  bindRemoveButtons() {
    document.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.target.dataset.id;
        delete this.cart[id];
        this.renderCart();
      });
    });
  }

  async placeOrder() {
    if (Object.keys(this.cart).length === 0) return alert('سلة المشتريات فارغة.');

    const contactMethod = prompt('كيف تريد أن نتواصل معك؟ (البريد الإلكتروني أو رقم الهاتف)');
    if (!contactMethod) return alert('يجب إدخال طريقة تواصل.');

    const contactInfo = prompt(`يرجى إدخال ${contactMethod}:`);
    if (!contactInfo) return alert('يجب إدخال معلومات التواصل.');

    // إعداد الطلب مع التفاصيل
    const orderItems = Object.values(this.cart).map(item => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      vendorId: item.product.vendorId || null,
      storeName: item.product.storeName || '',
    }));

    // التحقق من توفر الكميات مجدداً قبل الطلب
    for (const item of orderItems) {
      const productDoc = await db.collection('products').doc(item.productId).get();
      if (!productDoc.exists || productDoc.data().quantity < item.quantity) {
        alert(`المنتج "${item.name}" غير متوفر بالكميات المطلوبة.`);
        return;
      }
    }

    // حفظ الطلب في قاعدة البيانات
    await db.collection('orders').add({
      items: orderItems,
      contactMethod,
      contactInfo,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert('تم إرسال طلبك بنجاح!');
    this.cart = {};
    this.renderCart();
  }
}

const customerShop = new CustomerShop();