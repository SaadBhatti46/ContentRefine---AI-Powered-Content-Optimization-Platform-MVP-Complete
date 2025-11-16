from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import re
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize LLM Chat
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Define Models
class ContentInput(BaseModel):
    title: str
    content: str
    content_type: str = "article"  # article, social_post, ad_copy

class AnalysisResult(BaseModel):
    readability_score: float
    seo_score: float
    tone: str
    keyword_density: Dict[str, float]
    word_count: int
    sentence_count: int
    suggestions: List[str]

class OptimizationResult(BaseModel):
    optimized_content: str
    improvements: List[str]

class VariantResult(BaseModel):
    variant_a: str
    variant_b: str
    differences: List[str]

class ContentJob(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    original_content: str
    content_type: str
    status: str = "processing"  # processing, completed, failed
    analysis: Optional[AnalysisResult] = None
    optimization: Optional[OptimizationResult] = None
    variants: Optional[VariantResult] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

# Helper functions for content analysis
def calculate_readability(text: str) -> float:
    """Calculate Flesch-Kincaid readability score"""
    words = len(text.split())
    sentences = len(re.split(r'[.!?]+', text))
    syllables = sum([len(re.findall(r'[aeiouy]+', word.lower())) for word in text.split()])
    
    if sentences == 0 or words == 0:
        return 0.0
    
    # Flesch Reading Ease formula
    score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
    return max(0, min(100, score))

def calculate_seo_score(text: str, title: str) -> float:
    """Calculate basic SEO score"""
    score = 0.0
    words = text.split()
    word_count = len(words)
    
    # Optimal length (300-2000 words)
    if 300 <= word_count <= 2000:
        score += 30
    elif word_count > 2000:
        score += 20
    else:
        score += 10
    
    # Title in content
    if title.lower() in text.lower():
        score += 20
    
    # Has subheadings (simulated)
    if '\n' in text or len(text) > 500:
        score += 20
    
    # Keyword variety
    unique_words = len(set([w.lower() for w in words]))
    if word_count > 0:
        variety = unique_words / word_count
        score += variety * 30
    
    return min(100, score)

def extract_keywords(text: str) -> Dict[str, float]:
    """Extract top keywords with density"""
    words = [w.lower() for w in re.findall(r'\w+', text) if len(w) > 3]
    if not words:
        return {}
    
    word_freq = {}
    for word in words:
        word_freq[word] = word_freq.get(word, 0) + 1
    
    # Calculate density and get top 5
    total = len(words)
    densities = {k: (v / total) * 100 for k, v in word_freq.items()}
    sorted_keywords = sorted(densities.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return dict(sorted_keywords)

async def analyze_content_with_ai(content: str, title: str, content_type: str) -> AnalysisResult:
    """Analyze content using AI and algorithms"""
    # Calculate algorithmic scores
    readability = calculate_readability(content)
    seo_score = calculate_seo_score(content, title)
    keywords = extract_keywords(content)
    
    word_count = len(content.split())
    sentence_count = len(re.split(r'[.!?]+', content))
    
    # Use AI to analyze tone and get suggestions
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"analysis_{uuid.uuid4()}",
        system_message="You are a content analysis expert. Provide concise, actionable feedback."
    ).with_model("openai", "gpt-4o-mini")
    
    prompt = f"""Analyze this {content_type} content:

Title: {title}
Content: {content[:500]}...

Provide:
1. Primary tone (in 2-3 words: e.g., 'Professional and Informative', 'Casual and Engaging')
2. Three specific improvement suggestions (each under 15 words)

Format your response as:
TONE: [tone]
SUGGESTIONS:
1. [suggestion 1]
2. [suggestion 2]
3. [suggestion 3]"""
    
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse response
        tone_match = re.search(r'TONE:\s*(.+)', response)
        tone = tone_match.group(1).strip() if tone_match else "Neutral"
        
        suggestions = re.findall(r'\d+\.\s*(.+)', response)
        suggestions = suggestions[:3] if suggestions else ["Improve clarity", "Enhance engagement", "Optimize structure"]
        
    except Exception as e:
        logging.error(f"AI analysis error: {e}")
        tone = "Unable to analyze"
        suggestions = ["Improve readability", "Enhance SEO", "Strengthen engagement"]
    
    return AnalysisResult(
        readability_score=round(readability, 2),
        seo_score=round(seo_score, 2),
        tone=tone,
        keyword_density=keywords,
        word_count=word_count,
        sentence_count=sentence_count,
        suggestions=suggestions
    )

async def optimize_content_with_ai(content: str, title: str, analysis: AnalysisResult, content_type: str) -> OptimizationResult:
    """Optimize content using AI"""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"optimize_{uuid.uuid4()}",
        system_message="You are a content optimization expert specializing in SEO, readability, and engagement."
    ).with_model("openai", "gpt-4o-mini")
    
    prompt = f"""Optimize this {content_type}:

Title: {title}
Original Content:
{content}

Current Metrics:
- Readability Score: {analysis.readability_score}/100
- SEO Score: {analysis.seo_score}/100
- Tone: {analysis.tone}

Improve the content for better readability, SEO, and engagement. Keep the core message but make it more compelling and optimized. Return ONLY the optimized content, no explanations."""
    
    try:
        optimized = await chat.send_message(UserMessage(text=prompt))
        
        improvements = [
            "Enhanced readability and flow",
            "Improved SEO keyword integration",
            "Strengthened engagement and clarity",
            "Optimized structure and formatting"
        ]
        
        return OptimizationResult(
            optimized_content=optimized.strip(),
            improvements=improvements
        )
    except Exception as e:
        logging.error(f"Optimization error: {e}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

async def generate_variants_with_ai(optimized_content: str, title: str, content_type: str) -> VariantResult:
    """Generate A/B test variants"""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"variants_{uuid.uuid4()}",
        system_message="You are an A/B testing expert. Create distinct content variants for testing."
    ).with_model("openai", "gpt-4o-mini")
    
    prompt = f"""Create 2 distinct variants of this {content_type} for A/B testing:

Title: {title}
Optimized Content:
{optimized_content}

Create:
VARIANT A: Focus on emotional appeal and storytelling
VARIANT B: Focus on data, facts, and authority

Format:
VARIANT_A:
[content]

VARIANT_B:
[content]"""
    
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse variants
        variant_a_match = re.search(r'VARIANT_A:\s*(.+?)(?=VARIANT_B:|$)', response, re.DOTALL)
        variant_b_match = re.search(r'VARIANT_B:\s*(.+?)$', response, re.DOTALL)
        
        variant_a = variant_a_match.group(1).strip() if variant_a_match else optimized_content
        variant_b = variant_b_match.group(1).strip() if variant_b_match else optimized_content
        
        differences = [
            "Variant A: Emotional and narrative-driven approach",
            "Variant B: Data-focused and authoritative tone",
            "Both optimized for different audience segments"
        ]
        
        return VariantResult(
            variant_a=variant_a,
            variant_b=variant_b,
            differences=differences
        )
    except Exception as e:
        logging.error(f"Variant generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Variant generation failed: {str(e)}")

async def process_content_job(job_id: str, content_input: ContentInput):
    """Background task to process content optimization"""
    try:
        # Step 1: Analyze
        analysis = await analyze_content_with_ai(
            content_input.content, 
            content_input.title, 
            content_input.content_type
        )
        
        # Update job with analysis
        await db.content_jobs.update_one(
            {"id": job_id},
            {"$set": {"analysis": analysis.model_dump()}}
        )
        
        # Step 2: Optimize
        optimization = await optimize_content_with_ai(
            content_input.content,
            content_input.title,
            analysis,
            content_input.content_type
        )
        
        # Update job with optimization
        await db.content_jobs.update_one(
            {"id": job_id},
            {"$set": {"optimization": optimization.model_dump()}}
        )
        
        # Step 3: Generate variants
        variants = await generate_variants_with_ai(
            optimization.optimized_content,
            content_input.title,
            content_input.content_type
        )
        
        # Update job as completed
        await db.content_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "variants": variants.model_dump(),
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
    except Exception as e:
        logging.error(f"Job processing error: {e}")
        # Update job as failed
        await db.content_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Content Optimization Platform API", "version": "1.0.0"}

@api_router.post("/content/submit")
async def submit_content(content_input: ContentInput, background_tasks: BackgroundTasks):
    """Submit content for optimization"""
    job = ContentJob(
        title=content_input.title,
        original_content=content_input.content,
        content_type=content_input.content_type
    )
    
    # Store job in database
    job_dict = job.model_dump()
    job_dict['created_at'] = job_dict['created_at'].isoformat()
    
    await db.content_jobs.insert_one(job_dict)
    
    # Process in background
    background_tasks.add_task(process_content_job, job.id, content_input)
    
    return {"job_id": job.id, "status": "processing"}

@api_router.get("/content/job/{job_id}")
async def get_job_status(job_id: str):
    """Get job status and results"""
    job = await db.content_jobs.find_one({"id": job_id}, {"_id": 0})
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Convert ISO strings back to datetime for created_at
    if isinstance(job.get('created_at'), str):
        job['created_at'] = datetime.fromisoformat(job['created_at'])
    
    if job.get('completed_at') and isinstance(job['completed_at'], str):
        job['completed_at'] = datetime.fromisoformat(job['completed_at'])
    
    return job

@api_router.get("/content/jobs")
async def get_all_jobs(limit: int = 20):
    """Get all content jobs"""
    jobs = await db.content_jobs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Convert timestamps
    for job in jobs:
        if isinstance(job.get('created_at'), str):
            job['created_at'] = datetime.fromisoformat(job['created_at'])
        if job.get('completed_at') and isinstance(job['completed_at'], str):
            job['completed_at'] = datetime.fromisoformat(job['completed_at'])
    
    return jobs

@api_router.delete("/content/job/{job_id}")
async def delete_job(job_id: str):
    """Delete a job"""
    result = await db.content_jobs.delete_one({"id": job_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"message": "Job deleted successfully"}

@api_router.get("/stats")
async def get_stats():
    """Get platform statistics"""
    total_jobs = await db.content_jobs.count_documents({})
    completed_jobs = await db.content_jobs.count_documents({"status": "completed"})
    processing_jobs = await db.content_jobs.count_documents({"status": "processing"})
    failed_jobs = await db.content_jobs.count_documents({"status": "failed"})
    
    # Get average scores from completed jobs
    completed = await db.content_jobs.find({"status": "completed"}, {"_id": 0, "analysis": 1}).to_list(100)
    
    avg_readability = 0
    avg_seo = 0
    if completed:
        readability_scores = [job['analysis']['readability_score'] for job in completed if job.get('analysis')]
        seo_scores = [job['analysis']['seo_score'] for job in completed if job.get('analysis')]
        
        avg_readability = sum(readability_scores) / len(readability_scores) if readability_scores else 0
        avg_seo = sum(seo_scores) / len(seo_scores) if seo_scores else 0
    
    return {
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "processing_jobs": processing_jobs,
        "failed_jobs": failed_jobs,
        "avg_readability_score": round(avg_readability, 2),
        "avg_seo_score": round(avg_seo, 2)
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()