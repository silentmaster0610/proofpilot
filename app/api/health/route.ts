import { getClient } from "../../../db";
export const dynamic="force-dynamic";
export async function GET() {
  try {await (await getClient()).execute("SELECT 1");return Response.json({status:"ok"},{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({status:"unavailable"},{status:503});}
}
