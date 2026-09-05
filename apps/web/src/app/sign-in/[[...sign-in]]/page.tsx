import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="sign-wrap">
      <SignIn />
    </div>
  );
}
