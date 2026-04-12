import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { Role, userStatus } from "../../generated/prisma/enums";
import { bearer, emailOTP } from "better-auth/plugins";
import { sendEmail } from "../utils/email";
import { envVars } from "../config/env";
// If your Prisma file is located elsewhere, you can change the path


export const auth = betterAuth({
  baseURL: envVars.BETTER_AUTH_URL,
  secret: envVars.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders:{
    google:{
        clientId: envVars.GOOGLE_CLIENT_ID,
        clientSecret: envVars.GOOGLE_CLIENT_SECRET,
        callbackURL: envVars.GOOGLE_CALLBACK_URL,
        mapProfileToUser: ()=>{
            return {
                role : Role.USER,
                status : userStatus.ACTIVE,
                needPasswordChange : false,
                emailVerified : true,
                isDeleted : false,
                deletedAt : null,
            }
        }
    }
},
  emailVerification:{
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
},
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: Role.USER,
      },
      status: {
        type: "string",
        defaultValue: userStatus.PENDING_VERIFICATION,
      },
      needPasswordChange: {
        type: "boolean",
        defaultValue: false,
      },
      isDeleted: {
        type: "boolean",
        defaultValue: false,
      },
      deletedAt: {
        type: "date",
        required: false,
      },
    },
  },
  plugins: [
    bearer(),
    emailOTP({
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({email, otp, type}) {
            if(type === "email-verification"){
              const user = await prisma.user.findUnique({
                where : {
                    email,
                }
              })
              
              if(user && !user.emailVerified){
                sendEmail({
                    to : email,
                    subject : "Verify your email",
                    templateName : "otp",
                    templateData :{
                        name : user.name,
                        otp,
                    }
                })
              }
            }else if(type === "forget-password"){
                const user = await prisma.user.findUnique({
                    where : {
                        email,
                    }
                })

                if(user){
                    sendEmail({
                        to : email,
                        subject : "Password Reset OTP",
                        templateName : "otp",
                        templateData :{
                            name : user.name,
                            otp,
                        }
                    })
                }
            }
        },
        expiresIn : 2 * 60, // 2 minutes in seconds
        otpLength : 6,
    })
],

  session: {
    expiresIn: 60 * 60 * 24, // ✅ 1 day (FIXED)
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24,
    },
  },
  redirectURLs:{
    signIn : `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success`,
},
trustedOrigins: [envVars.BETTER_AUTH_URL, envVars.FRONTEND_URL],

advanced: {
    // disableCSRFCheck: true,
    useSecureCookies : false,
    cookies:{
        state:{
            attributes:{
                sameSite: "none",
                secure: true,
                httpOnly: true,
                path: "/",
            }
        },
        sessionToken:{
            attributes:{
                sameSite: "none",
                secure: true,
                httpOnly: true,
                path: "/",
            }
        }
    }
}
});