document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/caja/total')
      .then(res => {
        if (!res.ok) throw new Error('Respuesta no OK');
        return res.json();
      })
      .then(data => {
        console.log('🧾 Respuesta recibida:', data);
        if ('totalCaja' in data) {
          document.getElementById('totalEnCaja').textContent = `S/. ${parseFloat(data.totalCaja).toFixed(2)}`;
        } else {
          console.warn('⚠️ totalCaja no encontrado en la respuesta:', data);
        }
      })
      .catch(err => {
        console.error('❌ Error al obtener total en caja:', err);
      });
  });
  