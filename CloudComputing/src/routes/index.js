const express = require('express');

const router = express.Router();

// urutan mount mengikuti urutan registrasi router lama (perilaku identik)
router.use(require('../modules/auth/auth.routes'));
router.use(require('../modules/users/users.routes'));
router.use(require('../modules/community/community.routes'));
router.use(require('../modules/articles/articles.routes'));
router.use(require('../modules/bookmarks/bookmarks.routes'));
router.use(require('../modules/scan/scan.routes'));

module.exports = router;
