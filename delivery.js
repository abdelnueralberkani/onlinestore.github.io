class DeliveryDashboard {
  constructor() {
    this.deliveryPersonId = null;
    this.init();
  }

  async init() {
    const email = prompt('ادخل بريدك الإلكتروني كعامل توصيل:');
    if (!email) return alert('البريد الإلكتروني مطلوب.');
    const usersSnap = await db.collection('users').where('email', '==', email).where('role', '==', 'delivery').get();
    if (usersSnap.empty) {
      alert('لا يوجد عامل توصيل مرتبط بهذا البريد الإلكتروني!');
      return;
    }
    this.deliveryPersonId = usersSnap.docs[0].id;
    this.loadAssignedOrders();
  }

  async loadAssignedOrders() {
    const container = document.getElementById('orders-container');
    container.innerHTML = '<p>جارٍ تحميل الطلبات...</p>';
    const ordersSnap = await db.collection('orders')
      .where('deliveryPersonId', '==', this.deliveryPersonId)
      .where('status', 'in', ['pending', 'out-for-delivery'])
      .get();

    if (ordersSnap.empty) {
      container.innerHTML = '<p>لا توجد طلبات مخصصة لك حالياً.</p>';
      return;
    }

    container.innerHTML = '';
    ordersSnap.forEach(doc => {
      const order = doc.data();
      container.innerHTML += `
        <div class="order-card" data-id="${doc.id}">
          <h3>طلب رقم: ${doc.id}</h3>
          <p>الحالة: ${order.status}</p>
          <p>التواصل: ${order.contactMethod} - ${order.contactInfo}</p>
          <p>العناصر:</p>
          <ul>
            ${order.items.map(item => `<li>${item.name} - الكمية: ${item.quantity}</li>`).join('')}
          </ul>
          <button class="btn-update-status" data-id="${doc.id}" data-status="delivered">تم التسليم</button>
          <button class="btn-update-status" data-id="${doc.id}" data-status="returned">تم الإرجاع</button>
        </div>
      `;
    });
    this.bindStatusButtons();
  }

  bindStatusButtons() {
    document.querySelectorAll('.btn-update-status').forEach(btn => {
      btn.addEventListener('click', async e => {
        const orderId = e.target.dataset.id;
        const newStatus = e.target.dataset.status;
        if (confirm(`هل أنت متأكد من تغيير حالة الطلب إلى "${newStatus === 'delivered' ? 'تم التسليم' : 'تم الإرجاع'}"؟`)) {
          await db.collection('orders').doc(orderId).update({
            status: newStatus,
            deliveryConfirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          alert('تم تحديث حالة الطلب بنجاح.');
          this.loadAssignedOrders();
        }
      });
    });
  }
}

const deliveryDashboard = new DeliveryDashboard();