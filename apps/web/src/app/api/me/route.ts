import { CALL_MAX_SECONDS } from "@osp/core";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { publicBrand } from "@/lib/brand";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({
      user: { id: user.id, name: user.name, email: user.email },
      settings: { appName: publicBrand().appName, callMaxSeconds: CALL_MAX_SECONDS },
    });
  } catch (err) {
    return asError(err);
  }
}
