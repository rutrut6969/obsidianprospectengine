"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TemplateRow {
  id: string;
  name: string;
  type: string;
  subject: string;
  isActive: boolean;
  isSystem: boolean;
}

export function TemplatesDashboard() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("COLD_OUTREACH");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");

  async function load() {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, subject, text, html }),
    });
    if (!res.ok) alert((await res.json()).error ?? "Template create failed");
    setName("");
    setSubject("");
    setText("");
    setHtml("");
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Create template" description="Use {{businessName}}, {{businessCategory}}, {{senderName}}, {{companyName}}, {{websiteIssue}}, {{city}}, and {{ctaLink}}" />
        <CardBody>
          <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="templateName">Name</Label>
              <Input id="templateName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="templateType">Type</Label>
              <Select id="templateType" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="COLD_OUTREACH">Cold outreach</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="AUDIT_DELIVERY">Audit delivery</option>
                <option value="PROPOSAL">Proposal follow-up</option>
                <option value="REMINDER">Reminder</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="text">Text</Label>
              <Textarea id="text" value={text} onChange={(e) => setText(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="html">HTML</Label>
              <Textarea id="html" value={html} onChange={(e) => setHtml(e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Templates" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-slate-800/50">
                  <td className="px-4 py-3 text-slate-200">{template.name}</td>
                  <td className="px-4 py-3"><Badge variant="purple">{template.type}</Badge></td>
                  <td className="px-4 py-3 text-slate-400">{template.subject}</td>
                  <td className="px-4 py-3">
                    <Badge variant={template.isActive ? "green" : "slate"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
