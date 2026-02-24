const express = require('express');
const router = express.Router();
const escpos = require('escpos');

// Asociar USB a escpos
escpos.USB = require('escpos-usb');

router.post('/', async (req, res) => {
  const { texto, copias } = req.body;

  if (!texto || typeof texto !== 'string' || texto.trim() === '') {
    return res.status(400).json({ exito: false, mensaje: 'Texto vacío' });
  }

  try {
    // Buscar impresoras USB disponibles
    const devices = escpos.USB.findPrinter();
    console.log("📦 Dispositivos USB encontrados:", devices);

    if (devices.length === 0) {
      return res.status(500).json({ exito: false, mensaje: 'No se encontró ninguna impresora USB' });
    }

    // Usar la primera impresora encontrada
    const device = new escpos.USB(devices[0].deviceDescriptor.idVendor, devices[0].deviceDescriptor.idProduct);
    const printer = new escpos.Printer(new escpos.Console(device)); // también puedes usar new escpos.Printer(device)

    device.open((err) => {
      if (err) {
        console.error("❌ Error al abrir el dispositivo:", err);
        return res.status(500).json({ exito: false, mensaje: 'No se pudo abrir la impresora' });
      }

      for (let i = 0; i < (copias || 1); i++) {
        printer
          .text(texto)
          .cut()
          .flush(); // ← asegúrate de enviar el trabajo
      }

      printer.close(); // cerrar después de imprimir
      res.json({ exito: true, mensaje: 'Impresión enviada' });
    });

  } catch (error) {
    console.error("❌ Error inesperado al imprimir:", error);
    res.status(500).json({ exito: false, mensaje: 'Error al imprimir' });
  }
});

module.exports = router;
