import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export default function TemplateDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplate();
  }, [slug]);

  const fetchTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/template/slug/${slug}`);
      setTemplate(response.data.template);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async () => {
    if (!template) return;
    try {
      const response = await api.post(`/template/${template.id}/use`);
      navigate(`/dashboard/editor/${response.data.exam.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to use template");
    }
  };

  const handlePreviewExam = async () => {
    if (!template) return;
    try {
      // Create a temporary exam from the template to preview
      const response = await api.post(`/template/${template.id}/use`);
      setPreviewExamId(response.data.exam.id);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to preview template");
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

  if (error) {
    return (
      <div className="mx-4 mt-4 p-4 bg-red-50 border-l-4 border-red-200 text-red-700">
        {error}
        <div className="mt-2">
          <button
            onClick={() => navigate(-1)}
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="flex items-center justify-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-4 mt-4">
        <div className="flex justify-between items-center px-4 py-3 border-b bg-gray-50">
          <h1 className="text-2xl font-bold text-gray-900">{template.title}</h1>
          <div className="space-x-2">
            <button
              onClick={() => navigate(-1)}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
            >
              Kembali ke daftar template
            </button>
          </div>
        </div>
      </div>

      {template.description && (
        <div className="mx-4 mt-4">
          <div className="bg-white shadow-md rounded-lg">
            <div className="px-4 py-3 border-b font-semibold text-gray-900">
              Deskripsi
            </div>
            <div className="px-4 py-3 text-gray-700">
              {template.description}
            </div>
          </div>
        </div>
      )}

      <div className="mx-4 mt-4 grid md:grid-cols-2 gap-6">
        <div className="bg-white shadow-md rounded-lg">
          <div className="px-4 py-3 border-b font-semibold text-gray-900">
            Pengaturan Default
          </div>
          <div className="px-4 py-3 grid md:grid-cols-3 gap-4 text-sm text-gray-500">
            <div>
              <p className="font-medium text-gray-900">{template.default_question_count}</p>
              <p className="text-xs">Soal</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">{template.default_duration}</p>
              <p className="text-xs">Menit</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">{template.difficulty}</p>
              <p className="text-xs">Kesulitan</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg">
          <div className="px-4 py-3 border-b font-semibold text-gray-900">
            Jenis Soal Default
          </div>
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {template.default_question_types.map((type: string, index: number) => (
              <span key={index} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{type}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4">
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleUseTemplate}
            className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark"
          >
            Gunakan Template Ini
          </button>
          <button
            onClick={handlePreviewExam}
            className="bg-gray-200 text-gray-900 px-6 py-2 rounded-md hover:bg-gray-300"
          >
            Pratinjau sebagai Ulangan
          </button>
        </div>
      </div>

      {/* Preview exam modal */}
      {previewExamId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">Pratinjau Ulangan dari Template</h2>
              <button
                onClick={() => setPreviewExamId(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                <strong>Judul:</strong> Ulangan dari template "{template.title}"
              </p>
              <p>
                <strong>Jumlah Soal:</strong> {template.default_question_count}
              </p>
              <p>
                <strong>Durasi:</strong> {template.default_duration} menit
              </p>
              <p>
                <strong>Kesulitan:</strong> {template.difficulty}
              </p>
              <p>
                <strong>Jenis Soal:</strong> {template.default_question_types.join(", ")}
              </p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setPreviewExamId(null)}
                className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
