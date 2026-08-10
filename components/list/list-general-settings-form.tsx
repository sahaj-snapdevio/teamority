"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { updateList } from "@/app/actions/list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const COLOR_PALETTE = [
  "#6B7280",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F43F5E",
];

interface ListGeneralSettingsFormProps {
  initialColor: string | null;
  initialDescription: string | null;
  initialName: string;
  listId: string;
  spaceId: string;
  workspaceId: string;
}

export function ListGeneralSettingsForm({
  workspaceId,
  spaceId,
  listId,
  initialName,
  initialColor,
  initialDescription,
}: ListGeneralSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [color, setColor] = React.useState(initialColor ?? COLOR_PALETTE[5]);
  const [description, setDescription] = React.useState(
    initialDescription ?? ""
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("List name is required");
      return;
    }
    setLoading(true);
    setError("");
    const result = await updateList(workspaceId, spaceId, listId, {
      name: name.trim(),
      color: color || null,
      description: description.trim() || null,
    });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="lg-name">Name</Label>
        <Input
          className="max-w-sm"
          disabled={loading}
          id="lg-name"
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          value={name}
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2.5">
          {COLOR_PALETTE.map((c) => (
            <button
              className="h-7 w-7 rounded-full focus:outline-none"
              key={c}
              onClick={() => setColor(c)}
              style={{
                backgroundColor: c,
                boxShadow:
                  color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
              }}
              type="button"
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lg-desc">
          Description{" "}
          <span className="text-base-content/60 font-normal">(optional)</span>
        </Label>
        <Textarea
          className="max-w-sm"
          disabled={loading}
          id="lg-desc"
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this list for?"
          rows={3}
          value={description}
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex justify-end">
        <Button disabled={loading || !name.trim()} type="submit">
          {loading ? "Saving…" : saved ? "Saved!" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
