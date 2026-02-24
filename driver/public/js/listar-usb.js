const escpos = require('escpos');
escpos.USB = require('escpos-usb');

const VENDOR_ID = 0x0fe6;
const PRODUCT_ID = 0x811e;

const device = new escpos.USB(VENDOR_ID, PRODUCT_ID); // ← así sí