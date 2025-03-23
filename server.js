const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Replace with your API keys
const PAGE_SPEED_API_KEY = process.env.PAGE_SPEED_API_KEY;
const OPENGRAPH_API_KEY = process.env.OPENGRAPH_API_KEY;
const SERP_API_KEY = process.env.SERP_API_KEY;


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
  
      // Simplify the OpenGraph.io API response
      const simplifiedResponse = {
        title: openGraphData.hybridGraph.title || openGraphData.openGraph.title || openGraphData.htmlInferred.title,
        description: openGraphData.hybridGraph.description || openGraphData.openGraph.description || openGraphData.htmlInferred.description,
        image: openGraphData.hybridGraph.image || openGraphData.openGraph.image?.url || openGraphData.htmlInferred.image,
        url: openGraphData.hybridGraph.url || openGraphData.openGraph.url || openGraphData.htmlInferred.url,
      };
  
      return simplifiedResponse;
    } catch (error) {
      console.error('Error fetching OpenGraph data:', error.message);
      return 'N/A';
    }
  };

// Function to fetch SERP data (example using SerpApi)
const getSerpData = async (url) => {
    const apiUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(url)}&api_key=${SERP_API_KEY}`;
    try {
      const response = await axios.get(apiUrl);
      const serpData = response.data;
  
      // Simplify the SERP API response
      const simplifiedResponse = {
        query: serpData.search_parameters.q,
        total_results: serpData.search_information.total_results,
        organic_results: serpData.organic_results.map(result => ({
          position: result.position,
          title: result.title,
          link: result.link,
          snippet: result.snippet,
        })),
        pagination: {
          current_page: serpData.pagination.current,
          next_page: serpData.pagination.next,
        },
      };
  
      return simplifiedResponse;
    } catch (error) {
      console.error('Error fetching SERP data:', error.message);
      return 'N/A';
    }
  };
// Function to calculate SEO rating
const calculateRating = (seoData) => {
  let rating = 0;

  // Page Speed Score (out of 100)
  if (seoData.pageSpeedScore !== 'N/A') {
    rating += seoData.pageSpeedScore / 10; // Convert to a score out of 10
  }

  // Meta Tags (title, description, canonical)
  if (seoData.pageTitle) rating += 2;
  if (seoData.metaDescription) rating += 2;
  if (seoData.canonicalTag) rating += 2;

  // H1 Tags
  if (seoData.h1Tags) rating += 2;

  // Ensure rating is between 0 and 10
  return Math.min(10, Math.max(0, rating));
};

// Main SEO analysis endpoint
app.post('/analyze-seo', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Fetch basic SEO data using Cheerio
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const seoData = {
      pageTitle: $('title').text(),
      metaDescription: $('meta[name="description"]').attr('content') || 'Not found',
      h1Tags: $('h1').map((i, el) => $(el).text()).get().join(', '),
      canonicalTag: $('link[rel="canonical"]').attr('href') || 'Not found',
    };

    // Fetch additional data from APIs
    seoData.pageSpeedScore = await getPageSpeedData(url);
    seoData.openGraphData = await getOpenGraphData(url);
    seoData.serpData = await getSerpData(url);

    // Calculate SEO rating
    seoData.rating = calculateRating(seoData);

    console.log('SEO Data:', seoData); // Log the data for debugging
    res.json(seoData);
  } catch (error) {
    console.error('Error analyzing SEO:', error.message);
    res.status(500).json({ error: 'Failed to fetch SEO data' });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));