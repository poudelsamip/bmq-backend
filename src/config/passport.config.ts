import passport from "passport";
import {
    Strategy as GoogleStrategy,
    StrategyOptions as GoogleStrategyOptions,
    Profile as GoogleProfile,
    VerifyCallback,
} from "passport-google-oauth20";
import {
    Strategy as GitHubStrategy,
    Profile as GitHubProfile,
} from "passport-github2";
import { env } from "./env.config";
import { AuthProvider } from "../entities/User.entity";
import { oauthLoginService } from "../modules/auth/auth.service";

// google
const googleOptions: GoogleStrategyOptions = {
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: env.GOOGLE_CALLBACK_URL,
};

passport.use(
    new GoogleStrategy(
        googleOptions,
        async (
            _accessToken: string,
            _refreshToken: string,
            profile: GoogleProfile,
            done: VerifyCallback,
        ) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(null, false, {
                        message:
                            "No email returned from Google. Please ensure your Google account has a verified email.",
                    });
                }

                const result = await oauthLoginService({
                    provider: AuthProvider.GOOGLE,
                    providerId: profile.id,
                    email,
                    name: profile.displayName || email.split("@")[0],
                });

                done(null, result);
            } catch (err) {
                done(null, false, { message: (err as Error).message });
            }
        },
    ),
);

//github
passport.use(
    new GitHubStrategy(
        {
            clientID: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            callbackURL: env.GITHUB_CALLBACK_URL,
        },
        async (
            _accessToken: string,
            _refreshToken: string,
            profile: GitHubProfile,
            done: VerifyCallback,
        ) => {
            try {
                // GitHub may return multiple emails; prefer the primary verified one
                const emailObj =
                    profile.emails?.find((e) => e.value) ?? profile.emails?.[0];
                const email = emailObj?.value;

                if (!email) {
                    return done(null, false, {
                        message:
                            "No email returned from GitHub. Please make your GitHub email public or grant email access.",
                    });
                }

                const result = await oauthLoginService({
                    provider: AuthProvider.GITHUB,
                    providerId: profile.id,
                    email,
                    name:
                        profile.displayName ||
                        profile.username ||
                        email.split("@")[0],
                });

                done(null, result);
            } catch (err) {
                done(null, false, { message: (err as Error).message });
            }
        },
    ),
);

export default passport;
