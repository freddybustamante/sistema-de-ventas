router.get('/total', async (req, res) => {
    try {
      const [movimientos] = await db.query(`SELECT tipo, monto FROM caja WHERE DATE(fecha) = CURDATE()`);
      const [ventas] = await db.query(`SELECT SUM(total) AS total FROM ventas WHERE DATE(fecha) = CURDATE() AND tipo_pago = 'efectivo'`);
      const [pagosCredito] = await db.query(`SELECT SUM(monto) AS total FROM pagos_credito WHERE DATE(fecha) = CURDATE()`);
  
      let apertura = 0;
      let totalIngresos = 0;
      let totalEgresos = 0;
  
      movimientos.forEach(mov => {
        if (mov.tipo === 'apertura') apertura += mov.monto;
        else if (mov.tipo === 'ingreso') totalIngresos += mov.monto;
        else if (mov.tipo === 'egreso') totalEgresos += mov.monto;
      });
  
      const totalVentas = ventas[0].total || 0;
      const totalPagosCredito = pagosCredito[0].total || 0;
  
      const totalCaja = apertura + totalIngresos + totalVentas + totalPagosCredito - totalEgresos;
  
      res.json({ totalCaja });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al calcular total en caja' });
    }
  });
  