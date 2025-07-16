class VendorDashboard {
  constructor() {
    this.vendorId = null;
    this.vendorData = null;
    this.init();
  }

  async init() {
    const email = prompt('ادخل بريدك الإلكتروني للبائع للولوج:');
    if (!email) return alert('البريد الإلكتروني مطلوب.');
    const usersSnap = await db.collection('users').where('email', '==', email).where('role', '==', 'vendor').get();
    if (usersSnap.empty) {
      alert('لا يوجد بائع مرتبط بهذا البريد الإلكتروني!');
      return;
    }
    this.vendorId = usersSnap.docs[0].id;
    this.vendorData = usersSnap.docs[0].data();
    this.loadVendorProducts();
    this.setupAddProductForm();
  }

  async loadVendorProducts() {
    const productsContainer = document.getElementById('vendor-products');
    productsContainer.innerHTML = '<p>جارٍ تحميل المنتجات...</p>';
    const productsSnap = await db.collection('products').where('vendorId', '==', this.vendorId).get();
    if (productsSnap.empty) {
      productsContainer.innerHTML = '<p>لا توجد منتجات حالياً.</p>';
      return;
    }
    productsContainer.innerHTML = '';
    productsSnap.forEach(doc => {
      const product = doc.data();
      productsContainer.innerHTML += `
        <div class="product-card" data-id="${doc.id}">
          <h3>${product.name}</h3>
          <p>السعر: ${product.price} ريال</p>
          <p>الكمية: ${product.quantity}</p>
          <button class="btn btn-danger delete-product" data-id="${doc.id}">حذف</button>
        </div>
      `;
    });
    this.setupDeleteButtons();
  }

  setupDeleteButtons() {
    document.querySelectorAll('.delete-product').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const productId = e.target.dataset.id;
        if (confirm('هل تريد حذف هذا المنتج؟')) {
          await db.collection('products').doc(productId).delete();
          alert('تم حذف المنتج بنجاح.');
          this.loadVendorProducts();
        }
      });
    });
  }

  setupAddProductForm() {
    const form = document.getElementById('add-product-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.productName.value.trim();
      const price = parseFloat(form.productPrice.value);
      const quantity = parseInt(form.productQuantity.value, 10);
      if (!name || isNaN(price) || isNaN(quantity) || price <= 0 || quantity < 0) {
        alert('يرجى إدخال بيانات صحيحة للمنتج.');
        return;
      }
      await db.collection('products').add({
        name,
        price,
        quantity,
        vendorId: this.vendorId,
        storeName: this.vendorData.storeName || 'متجر غير معروف',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('تم إضافة المنتج بنجاح.');
      form.reset();
      this.loadVendorProducts();
    });
  }
}

const vendorDashboard = new VendorDashboard();