import { App } from "@/components/main";
import { PROJECT_PLACEHOLDER } from "@/data/schema";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export default async function IndexPage() {
  // Crear el cliente de Supabase usando el helper de Next.js
  const supabase = createServerComponentClient({ cookies });

  // Obtener la sesión usando el cliente creado
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Obtener el último proyecto visitado de las cookies
  const cookieStore = cookies();
  const lastProjectId = cookieStore.get("__aivs_lastProjectId");

  return (
    <App
      projectId={lastProjectId?.value ?? PROJECT_PLACEHOLDER.id}
      session={session}
    />
  );
}
