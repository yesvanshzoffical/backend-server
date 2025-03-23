const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Ensure API keys are present
const PAGE_SPEED_API_KEY = process.env.PAGE_SPEED_API_KEY;
const OPENGRAPH_API_KEY = process.env.OPENGRAPH_API_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;

if (!PAGE_SPEED_API_KEY || !OPENGRAPH_API_KEY || !SERP_API_KEY) {
  console.warn("⚠️ Warning: One or more API keys are missing.");
}

// Function to fetch Google PageSpeed Insights data
const getPageSpeedData = async (url) => {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${PAGE_SPEED_API_KEY}`;
  try {
    const response = await axios.get(apiUrl);
    return response.data.lighthouseResult.categories.performance.score * 100; // Convert to percentage
  } catch (error) {
    console.error('Error fetching PageSpeed data:', error.message);
    return 'N/A';
  }
};

// Function to fetch OpenGraph data
const getOpenGraphData = async (url) => {
  const apiUrl = `https://opengraph.io/api/1.1/site/${encodeURIComponent(url)}?app_id=${OPENGRAPH_API_KEY}`;
  try {
    const response = await axios.get(apiUrl);
    const openGraphData = response.data;

    return {
      title: openGraphData.hybridGraph?.title || openGraphData.openGraph?.title || openGraphData.htmlInferred?.title || 'Not found',
      description: openGraphData.hybridGraph?.description || openGraphData.openGraph?.description || openGraphData.htmlInferred?.description || 'Not found',
      image: openGraphData.hybridGraph?.image || openGraphData.openGraph?.image?.url || openGraphData.htmlInferred?.image || 'Not found',
      url: openGraphData.hybridGraph?.url || openGraphData.openGraph?.url || openGraphData.htmlInferred?.url || 'Not found',
    };
  } catch (error) {
    console.error('Error fetching OpenGraph data:', error.message);
    return 'N/A';
  }
};

// Function to fetch SERP data (Google Search results)
const getSerpData = async (url) => {
  const apiUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(url)}&api_key=${SERP_API_KEY}`;
  try {
    const response = await axios.get(apiUrl);
    const serpData = response.data;

    return {
      query: serpData.search_parameters?.q || 'Unknown',
      total_results: serpData.search_information?.total_results || 0,
      organic_results: serpData.organic_results?.map(result => ({
        position: result.position,
        title: result.title,
        link: result.link,
        snippet: result.snippet,
      })) || [],
      pagination: {
        current_page: serpData.pagination?.current || 1,
        next_page: serpData.pagination?.next || null,
      },
    };
  } catch (error) {
    console.error('Error fetching SERP data:', error.message);
    return 'N/A';
  }
};

// Function to calculate SEO rating
const calculateRating = (seoData) => {
  let rating = 0;

  if (seoData.pageSpeedScore !== 'N/A') rating += seoData.pageSpeedScore / 10;
  if (seoData.pageTitle) rating += 2;
  if (seoData.metaDescription) rating += 2;
  if (seoData.canonicalTag) rating += 2;
  if (seoData.h1Tags.length > 0) rating += 2;

  return Math.min(10, Math.max(0, rating));
};

// SEO analysis endpoint
app.post('/analyze-seo', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const seoData = {
      pageTitle: $('title').text() || 'Not found',
      metaDescription: $('meta[name="description"]').attr('content') || 'Not found',
      h1Tags: $('h1').map((i, el) => $(el).text()).get() || [],
      canonicalTag: $('link[rel="canonical"]').attr('href') || 'Not found',
    };

    seoData.pageSpeedScore = await getPageSpeedData(url);
    seoData.openGraphData = await getOpenGraphData(url);
    seoData.serpData = await getSerpData(url);

    seoData.rating = calculateRating(seoData);

    console.log('SEO Data:', seoData);
    res.json(seoData);
  } catch (error) {
    console.error('Error analyzing SEO:', error.message);
    res.status(500).json({ error: 'Failed to fetch SEO data' });
  }
});

// Test route
app.get('/', (req, res) => {
  res.send("SEO API is running! Use POST /analyze-seo");
});

// Dynamic port for Render/Vercel
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
