//src/app/module/auth/auth.interface.ts
export interface IRegisterUserPayload {
  name: string;
  email: string;
  password: string;
}
export interface ILoginUserPayload {
  email: string;
  password: string;
}
export interface IChangePasswordPayload {
    currentPassword: string;
    newPassword: string;
}