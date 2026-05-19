const router = require('express').Router();
const multer = require('multer');
const { verificarToken }        = require('../middlewares/auth.middleware');
const { analizar, crearAsientos } = require('../controllers/importacion.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const ok  = ['.pdf', '.xlsx', '.xls', '.csv', '.txt']
      .some((e) => ext.endsWith(e));
    if (ok) cb(null, true);
    else    cb(new Error('Formato no soportado. Usa PDF, Excel (.xlsx/.xls) o CSV.'));
  },
});

router.use(verificarToken);
router.post('/analizar',       upload.single('archivo'), analizar);
router.post('/crear-asientos', crearAsientos);

module.exports = router;
