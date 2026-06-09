import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { KOREA_CITIES, KOREA_REGIONS } from "@/lib/korea-regions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "프로필 설정 · True Love" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
      if (data) {
        if (data.onboarded) {
          navigate({ to: "/", replace: true });
          return;
        }
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setCity(data.region_city ?? "");
        setDistrict(data.region_district ?? "");
      }
      setLoading(false);
    })();
  }, [navigate]);

  async function save() {
    if (!displayName.trim()) return toast.error("닉네임을 입력해주세요");
    if (bio.length > 30) return toast.error("소개는 30자 이내로 작성해주세요");
    if (!city || !district) return toast.error("사는 지역을 선택해주세요");

    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim(),
      bio: bio.trim(),
      region_city: city,
      region_district: district,
      onboarded: true,
    }).eq("id", u.user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("환영해요!");
    navigate({ to: "/", replace: true });
  }

  if (loading) return <div className="max-w-xl mx-auto p-6 text-center text-muted-foreground">불러오는 중...</div>;

  const districts = city ? KOREA_REGIONS[city] ?? [] : [];

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>프로필을 완성해주세요</CardTitle>
          <CardDescription>다른 분들이 볼 정보예요. 시작 전에 한 번만 채워주시면 돼요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">닉네임</Label>
            <Input id="name" value={displayName} maxLength={20} onChange={(e) => setDisplayName(e.target.value)} placeholder="어떻게 불릴까요?" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">한 줄 소개 <span className="text-xs text-muted-foreground">({bio.length}/30)</span></Label>
            <Textarea id="bio" value={bio} maxLength={30} rows={2} onChange={(e) => setBio(e.target.value)} placeholder="당신을 한 문장으로 표현한다면?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>시/도</Label>
              <Select value={city} onValueChange={(v) => { setCity(v); setDistrict(""); }}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {KOREA_CITIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>시/군/구</Label>
              <Select value={district} onValueChange={setDistrict} disabled={!city}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full">{saving ? "저장 중..." : "시작하기"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
