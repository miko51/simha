import { NextResponse } from "next/server";
import { convertToHebrew, hebrewBirthday, readingForDate } from "@/lib/hebcal";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const date = u.searchParams.get("date");
  const birth = u.searchParams.get("birth");
  const kind = u.searchParams.get("kind") || "bar";
  const lat = u.searchParams.get("lat");
  const lng = u.searchParams.get("lng");
  try {
    const out: Record<string, unknown> = {};
    if (date) {
      out.reading = await readingForDate(date, lat ? Number(lat) : null, lng ? Number(lng) : null);
      out.hebrew = await convertToHebrew(date);
    }
    if (birth) {
      out.birthHebrew = await convertToHebrew(birth);
      const years = kind === "bat" ? 12 : 13;
      out.milestones = await hebrewBirthday(birth, years);
      out.halakhicAge = years;
    }
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur calendrier" }, { status: 502 });
  }
}
