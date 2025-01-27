import { App } from "@/components/main";
import { PROJECT_PLACEHOLDER } from "@/data/schema";
import { cookies } from "next/headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase: SupabaseClient<any> = createClient(supabaseUrl, supabaseKey);
//const supabase = {fake: true};

export default async function IndexPage() {
    const cookieStore = await cookies();
    const lastProjectId = cookieStore.get("__aivs_lastProjectId");

    return (
        <>
            <App 
                projectId={lastProjectId?.value ?? PROJECT_PLACEHOLDER.id}
                //supabase={supabase}
            />
        </>
    );
}
