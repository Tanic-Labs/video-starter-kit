// import { type GetServerSideProps } from "next";
import Link from "next/link";
import { type NextPage } from "next";
import ForgotPasswordReset from "@/components/forgot-password";

const ForgotPassword: NextPage = () => {
  // const router = useRouter();

  // useEffect(() => {
  //     if (user) {
  //         router.push("/");
  //     }
  // }, [user, router]);

  return (
    <div className="absolute bg-[#141414] w-full h-full flex justify-center items-center px-6 md:px-0">
      <Link
        href="/"
        className="absolute left-8 top-8 py-2 px-4 rounded-md no-underline text-foreground bg-btn-background hover:bg-btn-background-hover flex items-center group text-sm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </Link>
      <ForgotPasswordReset />
    </div>
  );
};

// export const getServerSideProps: GetServerSideProps = async (ctx) => {
//   // Create authenticated Supabase Client
//   const serverSide = createPagesServerClient(ctx);
//   // Check if we have a session
//   const {
//     data: { session },
//   } = await serverSide.auth.getSession();

//   if (session) {
//     return {
//       redirect: {
//         destination: "/",
//         permanent: false,
//       },
//     };
//   }

//   return {
//     props: {},
//   };
// };

export default ForgotPassword;
