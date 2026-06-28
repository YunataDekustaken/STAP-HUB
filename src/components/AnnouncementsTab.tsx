import React, { useState } from "react";
import { Megaphone, Plus, Calendar, User, Trash2 } from "lucide-react";

export interface Announcement {
  id: string;
  title: string;
  category: "Road Closure" | "Maintenance" | "Safety Advisory" | "Weather Update" | "General Notice";
  content: string;
  datePublished: string;
  author: string;
}

interface AnnouncementsTabProps {
  announcements: Announcement[];
  onAddAnnouncement: (announcement: Omit<Announcement, "id" | "datePublished">) => void;
  onDeleteAnnouncement: (id: string) => void;
}

export default function AnnouncementsTab({ announcements, onAddAnnouncement, onDeleteAnnouncement }: AnnouncementsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Announcement["category"]>("Road Closure");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("STAP Hub Operator");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    onAddAnnouncement({
      title,
      category,
      content,
      author
    });
    setTitle("");
    setContent("");
    setShowForm(false);
  };

  return (
    <div className="space-y-6" id="announcements-tab">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">STAP Public Bulletins</h2>
          <p className="text-[11px] text-slate-500 font-medium">Publish and distribute road advisories, maintenance plans, and general alerts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-bold rounded-xl transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? "Cancel" : "Post Bulletin"}</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-2xl">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Broadcast Traffic Advisory Bulletin</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">BULLETIN TITLE</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sumulong Highway Resurfacing Notice"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">CATEGORY</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Announcement["category"])}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium"
                >
                  <option value="Road Closure">🚧 Road Closure</option>
                  <option value="Maintenance">🔧 Maintenance Work</option>
                  <option value="Safety Advisory">🛡️ Safety Advisory</option>
                  <option value="Weather Update">☁️ Weather Update</option>
                  <option value="General Notice">📋 General Notice</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">BROADCASTED BY</label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">DETAILED BODY TEXT</label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Advisory details, scheduled times, alternative detours..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-medium resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#1E293B] hover:bg-[#0F172A] text-white font-bold rounded-xl transition-all shadow-sm"
          >
            Broadcast Public Bulletin
          </button>
        </form>
      )}

      {/* Grid of bulletins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {announcements.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <Megaphone className="h-8 w-8 text-slate-300" />
              <span>No bulletins or advisories published yet</span>
            </div>
          </div>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-4">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    ann.category === "Road Closure"
                      ? "bg-rose-50 text-rose-600 border-rose-100"
                      : ann.category === "Maintenance"
                      ? "bg-amber-50 text-amber-600 border-amber-100"
                      : ann.category === "Safety Advisory"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                      : "bg-slate-50 text-slate-600 border-slate-100"
                  }`}>
                    {ann.category}
                  </span>
                  <button
                    onClick={() => onDeleteAnnouncement(ann.id)}
                    className="text-slate-300 hover:text-rose-500 p-1 rounded-lg transition-colors"
                    title="Delete announcement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                <h3 className="font-bold text-slate-800 text-sm mt-3 mb-2">{ann.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{ann.content}</p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-4 mt-4 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {ann.datePublished}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {ann.author}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
