class AdminDashboard {
  constructor() {
    this.commissionRate = 0.04; // 4% افتراضي
    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.loadVendors();
  }

  cacheElements() {
    this.adminContent = document.getElementById('admin-content');
    this.btnAddVendor = document.getElementById('btn-add-vendor');
    this.btnViewVendors = document.getElementById('btn-view-vendors');
    this.btnViewProducts = document.getElementById('btn-view-products');
    this.btnSetCommission = document.getElementById('btn-set-commission');
  }

  bindEvents() {
    this.btnAddVendor.addEventListener('click', () => this.showAddVendorForm());
    this.btnViewVendors.addEventListener('click', () => this.loadVendors());
    this.btnViewProducts.addEventListener('click', () => this.loadAllProducts());
    this.btnSetCommission.addEventListener('click', () => this.setCommission());
  }

  async showAddVendorForm() {
    this.adminContent.innerHTML = `
      <h3>إضافة بائع جديد</h3>
      <form id="add-vendor-form">
        <label>اسم البائع:</label><input type="text" id="vendor-name" required /><br/>
        <label>البريد الإلكتروني:</label><input type="email" id="vendor-email" required /><br/>
        <label>اسم المتجر:</label><input type="text" id="store-name" required /><br/>
        <button type="submit">إنشاء رمز الدخول</button>
      </form>
    `;
    document.getElementById('add-vendor-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('vendor-name').value.trim();
      const email = document.getElementById('vendor-email').value.trim();
      const storeName = document.getElementById('store-name').value
      .trim();
      if (!name || !email || !storeName) {
        alert('يرجى تعبئة جميع الحقول.');
        return;
      }
      // تحقق إذا كان البريد موجودًا مسبقًا
      const existingUser = await db.collection('users').where('email', '==', email).get();
      if (!existingUser.empty) {
        alert('هذا البريد الإلكتروني مستخدم بالفعل.');
        return;
      }
      // إنشاء رمز دخول عشوائي للبائع (يمكنك تعديله لاحقًا)
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // إضافة البائع إلى قاعدة البيانات
      await db.collection('users').add({
        name,
        email,
        role: 'vendor',
        storeName,
        accessCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      alert(`تم إنشاء رمز دخول للبائع: ${accessCode}`);
      this.loadVendors();
    });
  }

  async loadVendors() {
    this.adminContent.innerHTML = '<h3>قائمة البائعين</h3><p>جارٍ التحميل...</p>';
    const snapshot = await db.collection('users').where('role', '==', 'vendor').get();
    if (snapshot.empty) {
      this.adminContent.innerHTML = '<p>لا يوجد بائعين مسجلين حتى الآن.</p>';
      return;
    }
    let html = `<table border="1" cellpadding="5" cellspacing="0" style="width: 100%; text-align: center;">
      <thead>
        <tr>
          <th>الاسم</th>
          <th>البريد الإلكتروني</th>
          <th>اسم المتجر</th>
          <th>رمز الدخول</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>`;
    snapshot.forEach(doc => {
      const v = doc.data();
      html += `
      <tr data-id="${doc.id}">
        <td>${v.name}</td>
        <td>${v.email}</td>
        <td>${v.storeName}</td>
        <td>${v.accessCode}</td>
        <td>
          <button class="btn-delete-vendor" data-id="${doc.id}">حذف</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    this.adminContent.innerHTML = html;
    this.bindDeleteButtons();
  }

  bindDeleteButtons() {
    document.querySelectorAll('.btn-delete-vendor').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const vendorId = e.target.dataset.id;
        if (confirm('هل أنت متأكد من حذف هذا البائع؟ سيؤدي ذلك إلى حذف منتجاته أيضاً.')) {
          // حذف المنتجات الخاصة بالبائع
          const productsSnap = await db.collection('products').where('vendorId', '==', vendorId).get();
          const batch = db.batch();
          productsSnap.forEach(doc => batch.delete(doc.ref));
          batch.delete(db.collection('users').doc(vendorId));
          await batch.commit();
          alert('تم حذف البائع ومنتجاته بنجاح.');
          this.loadVendors();
        }
      });
    });
  }

  async loadAllProducts() {
    this.adminContent.innerHTML = '<h3>جميع المنتجات</h3><p>جارٍ التحميل...</p>';
    const snapshot = await db.collection('products').get();
    if (snapshot.empty) {
      this.adminContent.innerHTML = '<p>لا توجد منتجات حالياً.</p>';
      return;
    }
    let html = `<table border="1" cellpadding="5" cellspacing="0" style="width: 100%; text-align: center;">
      <thead>
        <tr>
          <th>اسم المنتج</th>
          <th>السعر</th>
          <th>الكمية</th>
          <th>اسم المتجر</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>`;
    snapshot.forEach(doc => {
      const p = doc.data();
      html += `
      <tr data-id="${doc.id}">
        <td>${p.name}</td>
        <td>${p.price}</td>
        <td>${p.quantity}</td>
        <td>${p.storeName || '-'}</td>
        <td>
          <button class="btn-delete-product" data-id="${doc.id}">حذف</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    this.adminContent.innerHTML = html;
    this.bindDeleteProductButtons();
  }

  bindDeleteProductButtons() {
    document.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const productId = e.target.dataset.id;
        if (confirm('هل تريد حذف هذا المنتج؟')) {
          await db.collection('products').doc(productId).delete();
          alert('تم حذف المنتج بنجاح.');
          this.loadAllProducts();
        }
      });
    });
  }

  async setCommission() {
    const input = prompt('أدخل نسبة الخصم التي ترغب بها (مثلاً 0.04 لـ 4%):', this.commissionRate);
    if (input === null) return; // إلغاء
    const value = parseFloat(input);
    if (isNaN(value) || value < 0 || value > 1) {
      alert('يرجى إدخال قيمة صحيحة بين 0 و1.');
      return;
    }
    this.commissionRate = value;
    // يمكن تخزينها في Firestore مثلاً في وثيقة منفصلة "settings"
    await db.collection('settings').doc('commission').set({ rate: this.commissionRate });
    alert(`تم تحديث نسبة الخصم إلى ${(this.commissionRate * 100).toFixed(2)}%`);
  }
}

const adminDashboard = new AdminDashboard();