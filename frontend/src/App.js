import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, FileText, TrendingUp, Zap, BarChart3, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("article");
  const [currentJob, setCurrentJob] = useState(null);
  const [jobHistory, setJobHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [activeTab, setActiveTab] = useState("create");

  useEffect(() => {
    fetchJobHistory();
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentJob && currentJob.status === "processing") {
      const interval = setInterval(() => {
        pollJobStatus(currentJob.id);
      }, 3000);
      setPollingInterval(interval);
      return () => clearInterval(interval);
    } else if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [currentJob]);

  const fetchJobHistory = async () => {
    try {
      const response = await axios.get(`${API}/content/jobs`);
      setJobHistory(response.data);
    } catch (error) {
      console.error("Failed to fetch job history:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const pollJobStatus = async (jobId) => {
    try {
      const response = await axios.get(`${API}/content/job/${jobId}`);
      const job = response.data;
      
      if (job.status === "completed" || job.status === "failed") {
        setCurrentJob(job);
        fetchJobHistory();
        fetchStats();
        
        if (job.status === "completed") {
          toast.success("Content optimization completed!");
        } else {
          toast.error("Optimization failed: " + (job.error || "Unknown error"));
        }
      } else {
        setCurrentJob(job);
      }
    } catch (error) {
      console.error("Failed to poll job status:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast.error("Please provide both title and content");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API}/content/submit`, {
        title,
        content,
        content_type: contentType
      });
      
      toast.success("Content submitted for optimization!");
      setCurrentJob({ id: response.data.job_id, status: "processing" });
      setActiveTab("results");
    } catch (error) {
      toast.error("Failed to submit content: " + (error.response?.data?.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    try {
      await axios.delete(`${API}/content/job/${jobId}`);
      toast.success("Job deleted");
      fetchJobHistory();
      if (currentJob?.id === jobId) {
        setCurrentJob(null);
      }
    } catch (error) {
      toast.error("Failed to delete job");
    }
  };

  const loadJob = async (jobId) => {
    try {
      const response = await axios.get(`${API}/content/job/${jobId}`);
      setCurrentJob(response.data);
      setActiveTab("results");
    } catch (error) {
      toast.error("Failed to load job");
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "processing":
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>ContentRefine</h1>
                <p className="text-xs text-gray-600">AI-Powered Content Optimization</p>
              </div>
            </div>
            
            {stats && (
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{stats.completed_jobs}</div>
                  <div className="text-xs text-gray-600">Optimized</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.avg_readability_score}</div>
                  <div className="text-xs text-gray-600">Avg Readability</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.avg_seo_score}</div>
                  <div className="text-xs text-gray-600">Avg SEO</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3" data-testid="main-tabs">
            <TabsTrigger value="create" data-testid="create-tab">
              <FileText className="w-4 h-4 mr-2" />
              Create
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="results-tab">
              <TrendingUp className="w-4 h-4 mr-2" />
              Results
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="history-tab">
              <BarChart3 className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card className="border-0 shadow-lg" data-testid="create-content-card">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
                <CardTitle className="text-2xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Create Content</CardTitle>
                <CardDescription>Submit your content for AI-powered analysis and optimization</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Content Type</label>
                    <Select value={contentType} onValueChange={setContentType}>
                      <SelectTrigger data-testid="content-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="article" data-testid="type-article">Article</SelectItem>
                        <SelectItem value="social_post" data-testid="type-social">Social Media Post</SelectItem>
                        <SelectItem value="ad_copy" data-testid="type-ad">Ad Copy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Title</label>
                    <Input
                      data-testid="content-title-input"
                      placeholder="Enter your content title..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Content</label>
                    <Textarea
                      data-testid="content-text-input"
                      placeholder="Paste or type your content here..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="min-h-[300px] text-base"
                    />
                    <div className="text-xs text-gray-500">
                      {content.split(/\s+/).filter(w => w).length} words, {content.split(/[.!?]+/).filter(s => s.trim()).length} sentences
                    </div>
                  </div>

                  <Button
                    data-testid="submit-content-button"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white py-6 text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Optimize Content
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            {!currentJob ? (
              <Card className="border-0 shadow-lg" data-testid="no-job-card">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600">No content job selected. Submit content to get started.</p>
                </CardContent>
              </Card>
            ) : currentJob.status === "processing" ? (
              <Card className="border-0 shadow-lg" data-testid="processing-card">
                <CardContent className="py-12 text-center">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Processing Your Content</h3>
                  <p className="text-gray-600 mb-4">AI is analyzing and optimizing your content...</p>
                  <div className="max-w-md mx-auto">
                    <Progress value={33} className="mb-2" />
                    <p className="text-xs text-gray-500">This usually takes 15-30 seconds</p>
                  </div>
                </CardContent>
              </Card>
            ) : currentJob.status === "failed" ? (
              <Card className="border-0 shadow-lg border-red-200" data-testid="failed-card">
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-red-700 mb-2">Optimization Failed</h3>
                  <p className="text-gray-600">{currentJob.error || "An error occurred during processing"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Analysis Results */}
                {currentJob.analysis && (
                  <Card className="border-0 shadow-lg" data-testid="analysis-results-card">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-green-600" />
                        Content Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg" data-testid="readability-score">
                          <div className="text-3xl font-bold text-blue-600">{currentJob.analysis.readability_score}</div>
                          <div className="text-sm text-gray-600">Readability Score</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg" data-testid="seo-score">
                          <div className="text-3xl font-bold text-purple-600">{currentJob.analysis.seo_score}</div>
                          <div className="text-sm text-gray-600">SEO Score</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg" data-testid="word-count">
                          <div className="text-3xl font-bold text-orange-600">{currentJob.analysis.word_count}</div>
                          <div className="text-sm text-gray-600">Word Count</div>
                        </div>
                        <div className="bg-pink-50 p-4 rounded-lg" data-testid="tone-display">
                          <div className="text-lg font-bold text-pink-600">{currentJob.analysis.tone}</div>
                          <div className="text-sm text-gray-600">Detected Tone</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Top Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(currentJob.analysis.keyword_density).map(([keyword, density]) => (
                            <Badge key={keyword} variant="secondary" data-testid={`keyword-${keyword}`}>
                              {keyword}: {density.toFixed(2)}%
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Improvement Suggestions</h4>
                        <ul className="space-y-2">
                          {currentJob.analysis.suggestions.map((suggestion, idx) => (
                            <li key={idx} className="flex items-start gap-2" data-testid={`suggestion-${idx}`}>
                              <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                              <span className="text-gray-700">{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Optimized Content */}
                {currentJob.optimization && (
                  <Card className="border-0 shadow-lg" data-testid="optimization-results-card">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-indigo-600" />
                        Optimized Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Improvements Made</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {currentJob.optimization.improvements.map((improvement, idx) => (
                            <Badge key={idx} className="bg-indigo-100 text-indigo-700" data-testid={`improvement-${idx}`}>
                              {improvement}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="bg-gray-50 p-6 rounded-lg" data-testid="optimized-content-display">
                        <h4 className="font-semibold mb-3 text-gray-900">Optimized Version</h4>
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{currentJob.optimization.optimized_content}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* A/B Variants */}
                {currentJob.variants && (
                  <Card className="border-0 shadow-lg" data-testid="variants-results-card">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        A/B Test Variants
                      </CardTitle>
                      <CardDescription>Two optimized variants for testing different approaches</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">Variant Strategy</h4>
                        <ul className="space-y-2">
                          {currentJob.variants.differences.map((diff, idx) => (
                            <li key={idx} className="text-sm text-gray-700" data-testid={`difference-${idx}`}>• {diff}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50/50" data-testid="variant-a-display">
                          <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">A</span>
                            Variant A
                          </h4>
                          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{currentJob.variants.variant_a}</p>
                        </div>

                        <div className="border-2 border-purple-200 rounded-lg p-6 bg-purple-50/50" data-testid="variant-b-display">
                          <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                            <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">B</span>
                            Variant B
                          </h4>
                          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{currentJob.variants.variant_b}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="border-0 shadow-lg" data-testid="history-card">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Content History</CardTitle>
                    <CardDescription>View and manage your optimization jobs</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchJobHistory} data-testid="refresh-history-button">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {jobHistory.length === 0 ? (
                  <div className="text-center py-12" data-testid="no-history-message">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No content jobs yet. Start by creating your first optimization!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobHistory.map((job) => (
                      <div
                        key={job.id}
                        data-testid={`job-${job.id}`}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
                        onClick={() => loadJob(job.id)}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {getStatusIcon(job.status)}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{job.title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <Badge variant="outline" className="text-xs">{job.content_type}</Badge>
                              <Badge className={`text-xs ${getStatusColor(job.status)}`}>{job.status}</Badge>
                              <span className="text-xs text-gray-500">
                                {new Date(job.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteJob(job.id);
                          }}
                          data-testid={`delete-job-${job.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
