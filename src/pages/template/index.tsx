import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export default function TemplateIndex() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    subject: "",
    grade: "",
    category: "",
    search: "",
    visibility: "public" as "public" | "private",
  });

  useEffect(() => {
    fetchTemplates();
  }, [filters]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.subject) params.append("subject", filters.subject);
      if (filters.grade) params.append("grade", filters.grade);
      if (filters.category) params.append("category", filters.category);
      if (filters.search) params.append("search", filters.search);
      params.append("visibility", filters.visibility);

      const response = await api.get(`/template?${params.toString()}`);
      setTemplates(response.data.templates);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    try {
      await api.post(`/template/${templateId}/use`);
      navigate(`/dashboard/editor`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to use template");
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
      <div className="bg-white shadow-md rounded-lg mx-4 mt-6">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h1 className="text-2xl font-bold text-gray-900">Template Ulangan</h1>
          <div className="space-x-2">
            <button
              onClick={() => navigate("/template/create")}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
            >
              Buat Template Baru
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Judul
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject / Grade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jenis Soal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah Soal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durasi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-center text-gray-500" colSpan="6">
                    Belum ada template yang sesuai dengan filter. Buat template baru atau ubah filter.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{template.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.subject} {template.grade}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {template.default_question_types.map((type: string) => (
                          <span key={type} className="px-2 py-1 bg-gray-100 text-xs rounded-full">{type}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.default_question_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.default_duration} menit
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => navigate(`/template/${template.slug}`)}
                        className="text-primary underline offset-1 hover:no-underline"
                      >
                        Lihat Detail
                      </button>
                      <br />
                      <button
                        onClick={() => handleUseTemplate(template.id)}
                        className="mt-2 text-success underline offset-1 hover:no-underline"
                      >
                        Gunakan Template
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-50 border-l-4 border-red-200 text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-4 mx-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            value={filters.subject}
            onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
          <input
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            value={filters.grade}
            onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
            value={filters.visibility}
            onChange={(e) => setFilters({ ...filters, visibility: e.target.value as any })}
          >
            <option value="public">Publik</option>
            <option value="private">Privat</option>
          </select>
        </div>
      </div>

      <div className="mt-4 mx-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Cari template...</label>
        <input
          className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>
    </>
  );
}
