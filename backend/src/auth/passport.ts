
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from '../config/db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "MISSING_ID";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "MISSING_SECRET";
const CALLBACK_URL = process.env.CALLBACK_URL || "http://localhost:3001/auth/google/callback";

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (res.rows.length > 0) {
            done(null, res.rows[0]);
        } else {
            done(new Error("User not found"), null);
        }
    } catch (e) {
        done(e, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists
        const res = await pool.query("SELECT * FROM users WHERE id = $1", [profile.id]);

        if (res.rows.length === 0) {
            // Register new user
            const email = profile.emails?.[0]?.value || "";
            const photo = profile.photos?.[0]?.value || "";
            const name = profile.displayName || "Unknown";

            await pool.query(
                "INSERT INTO users (id, email, display_name, photo_url) VALUES ($1, $2, $3, $4)",
                [profile.id, email, name, photo]
            );
            return done(null, { id: profile.id, email, display_name: name, photo_url: photo });
        } else {
            // Update last login
            await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [profile.id]);
            return done(null, res.rows[0]);
        }
    } catch (e) {
        return done(e, undefined);
    }
}));

export default passport;
