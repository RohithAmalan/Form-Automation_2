
import express from 'express';
import passport from 'passport';

const router = express.Router();

// 1. Redirect to Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. Callback from Google
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=failed' }),
    (req, res) => {
        // Successful authentication
        // Redirect to Frontend Dashboard
        res.redirect('http://localhost:3000/');
    }
);

// 3. User Info (for Frontend)
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false, user: null });
    }
});

// 4. Logout
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.json({ success: true });
    });
});

export default router;
