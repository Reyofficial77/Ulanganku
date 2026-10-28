
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Card, Container, Form, Input, Label, Select, Spinner, ToastContainer, Toast } from "@/components/ui";
import { api } from "@/lib/api";

export default function TemplateEdit() {
  const { id } = useParams<{ id: string }>();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionTypes, setQuestionTypes] = useState<string[]>([
    "multiple_choice",
    "true_false",
    "short_answer",
    "essay",
  ]);

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/template/${id}`);
      const template = response.data.template;
      setFormData({
        title: template.title,
        slug: template.slug,
        description: template.description || "",
        subject: template.subject || "",
        grade: template.grade || "",
        category: template.category || "",
        default_question_types: template.default_question_types,
        default_question_count: template.default_question_count,
        default_duration: template.default_duration,
        difficulty: template.difficulty,
        visibility: template.visibility,
        status: template.status,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    let newValue: any = value;
    if (type === "checkbox") newValue = checked;
    if (name === "default_question_types") {
      // Handle multiple select
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
      await api.put(`/template/${id}`, formData);
      navigate(`/template/${formData.slug}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update template");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Yakin ingin menghapus template ini?")) return;
    setLoading(true);
    try {
      await api.delete(`/template/${id}`);
      navigate("/template");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete template");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-8">
        <Spinner size="lg" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-8">
        <Card>
          <Card.Header>
            <h2>Error</h2>
          </Card.Header>
          <Card.Body>
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
            >
              Kembali
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <>
      <ToastContainer position="top-center" />
      <Container className="py-8">
        <Row className="mb-6">
          <Col md={6}>
            <h1 className="text-2xl font-bold">Edit Template</h1>
          </Col>
          <Col md={6} className="text-right">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="w-full md:w-auto"
            >
              Kembali
            </Button>
            <Button
              color="danger"
              onClick={handleDelete}
              className="w-full md:w-auto"
            >
              Hapus Template
              </Button>
          </Col>
        </Row>

        <Form onSubmit={handleSubmit}>
          <Row className="mb-4">
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Label htmlFor="title">Judul Template *</Label>
                <Input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Misalnya: Ulangan Matematika Kelas 8"
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group className="mb-3">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  type="text"
                  id="slug"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  required
                  placeholder=" Misalnya: matematika-kelas-8"
                />
                <small className="text-muted-foreground">
                  Hanya huruf kecil, angka, dan tanda hubung. Otomatis diubah menjadi huruf kecil.
                </small>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col xs={12}>
              <Form.Group className="mb-3">
                <Label htmlFor="description">Deskripsi</Label>
                <Input
                  type="textarea"
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Jelaskan tentang template ini..."
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Misalnya: Matematika"
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="grade">Grade</Label>
                <Input
                  type="text"
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  placeholder="Misalnya: 8"
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="category">Category</Label>
                <Input
                  type="text"
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Misalnya: Persamaan Linier"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col xs={12}>
              <Form.Group className="mb-3">
                <Label>Jenis Soal Default</Label>
                <div className="mb-2">
                  {questionTypes.map((type) => (
                    <label key={type} className="me-3">
                      <input
                        type="checkbox"
                        checked={formData.default_question_types.includes(type)}
                        onChange={() => handleQuestionTypeToggle(type)}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="default_question_count">Jumlah Soal Default</Label>
                <Input
                  type="number"
                  id="default_question_count"
                  name="default_question_count"
                  min="1"
                  max="500"
                  value={formData.default_question_count}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="default_duration">Durasi Default (menit)</Label>
                <Input
                  type="number"
                  id="default_duration"
                  name="default_duration"
                  min="1"
                  max="600"
                  value={formData.default_duration}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="difficulty">Kesulitan</Label>
                <Select
                  id="difficulty"
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleChange}
                >
                  <option value="mudah">Mudah</option>
                  <option value="sedang">Sedang</option>
                  <option value="sulit">Sulit</option>
                </Select>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="visibility">Visibilitas</Label>
                <Select
                  id="visibility"
                  name="visibility"
                  value={formData.visibility}
                  onChange={handleChange}
                >
                  <option value="private">Privat (Hanya Anda)</option>
                  <option value="public">Publik (Semua orang dapat melihat)</option>
                </Select>
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Group className="mb-3">
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              </Form.Group>
            </Col>
          </Row>

          {error && (
            <Col xs={12}>
              <Alert variant="destructive">
                {error}
              </Alert>
            </Col>
          )}

          <Row className="mb-4">
            <Col xs={12}>
              <Button
                type="submit"
                color="primary"
                className="w-full"
              >
                Simpan Perubahan
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </>
  );
}

// We need to import Alert, but we'll use a simple div for now.
// We'll replace the Alert with a div later.
