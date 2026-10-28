import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export default function TemplateCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    subject: "",
    grade: "",
    category: "",
    default_question_types: [] as string[],
    default_question_count: 10,
    default_duration: 45,
    difficulty: "sedang",
    visibility: "private" as "public" | "private",
    status: "draft" as "draft" | "published",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionTypes, setQuestionTypes] = useState<string[]>([
    "multiple_choice",
    "true_false",
    "short_answer",
    "essay",
  ]);

  useEffect(() => {
    // Fetch available question types if needed
    // For now, we use the hardcoded list
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    let newValue: any = value;
    if (type === "checkbox") newValue = checked;
    if (name === "default_question_types") {
      // We'll handle this separately
      return;
    }
    setFormData({ ...formData, [name]: newValue });
  };

  const handleQuestionTypeToggle = (type: string) => {
    setFormData({
      ...formData,
      default_question_types: formData.default_question_types.includes(type)
        ? formData.default_question_types.filter((t) => t !== type)
        : [...formData.default_question_types, type],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/template", formData);
      navigate(`/template/${response.data.template.slug}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create template");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-4 mt-4">
        <div className="flex justify-between items-center px-4 py-3 border-b bg-gray-50">
          <h1 className="text-2xl font-bold text-gray-900">Buat Template Baru</h1>
          <div className="space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
            >
              Kembali
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-4 mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Judul Template *</label>
          <input
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="Misalnya: Ulangan Matematika Kelas 8"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug *</label>
          <input
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            type="text"
            id="slug"
            name="slug"
            value={formData.slug}
            onChange={handleChange}
            required
            placeholder="Misalnya: matematika-kelas-8"
          />
          <p className="mt-1 text-xs text-gray-500">
            Hanya huruf kecil, angka, dan tanda hubung. Otomatis diubah menjadi huruf kecil.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
          <textarea
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            placeholder="Jelaskan tentang template ini..."
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Misalnya: Matematika"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
            <input
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              type="text"
              id="grade"
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              placeholder="Misalnya: 8"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              type="text"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Misalnya: Persamaan Linier"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Soal Default</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {questionTypes.map((type) => (
              <label key={type} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.default_question_types.includes(type)}
                  onChange={() => handleQuestionTypeToggle(type)}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal Default</label>
            <input
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              type="number"
              id="default_question_count"
              name="default_question_count"
              min="1"
              max="500"
              value={formData.default_question_count}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durasi Default (menit)</label>
            <input
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              type="number"
              id="default_duration"
              name="default_duration"
              min="1"
              max="600"
              value={formData.default_duration}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kesulitan</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              id="difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={handleChange}
            >
              <option value="mudah">Mudah</option>
              <option value="sedang">Sedang</option>
              <option value="sulit">Sulit</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibilitas</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              id="visibility"
              name="visibility"
              value={formData.visibility}
              onChange={handleChange}
            >
              <option value="private">Privat (Hanya Anda)</option>
              <option value="public">Publik (Semua orang dapat melihat)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-4 bg-red-50 border-l-4 border-red-200 text-red-700">
            {error}
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            className="w-full bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark"
          >
            Simpan Template
          </button>
        </div>
      </form>
    </>
  );
}
