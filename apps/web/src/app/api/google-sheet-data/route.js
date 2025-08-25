// Google Sheets API route

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// We're not using mock data anymore as per user's request
// The application will only use actual spreadsheet data

export async function GET(request) {
  // Set the correct content type for the response
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  try {
    // Parse query parameters from the request URL
    const url = new URL(request.url);
    const params = url.searchParams;
    
    // Google Apps Script web app URL that serves the data
    // IMPORTANT: Make sure the URL is for a properly deployed web app set to:
    // - Execute as: Me (your account)
    // - Who has access: Anyone (even anonymous)
    // - The script must return JSON or CSV data, not HTML
    const googleAppsScriptUrls = [
      "https://script.google.com/macros/s/AKfycbxT_VzkKxpOVgzvSpXf-ksaZ7mhPBEKORV4cnAOIPMYwbMmfUl0239W_rrT20NbIwX9HA/exec",
      // Add any alternative URLs here if available
    ];
    
    // Log to confirm we're trying to get the actual spreadsheet data
    console.log('Attempting to fetch actual spreadsheet data from Google Apps Script');
    
    let googleAppsScriptUrl = googleAppsScriptUrls[0]; // Use the first URL by default
    
    // Forward any query parameters to the Google Apps Script
    // Add a format=json parameter to explicitly request JSON output
    if (params.toString()) {
      googleAppsScriptUrl += `?${params.toString()}&format=json`;
    } else {
      googleAppsScriptUrl += `?format=json`;
    }
    
    console.log(`Fetching data from: ${googleAppsScriptUrl}`);
    
    // Fetch data from Google Apps Script with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      console.log('Attempting to fetch data from Google Apps Script...');
      const response = await fetch(googleAppsScriptUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/csv',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        // Bypass any caching to ensure fresh data
        cache: 'no-store',
        redirect: 'follow'
      });
      
      // Clear the timeout since the request completed
      clearTimeout(timeoutId);
      
      console.log('Fetch completed with status:', response.status);
    
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        throw new Error(`Failed to fetch spreadsheet data: ${response.status} ${statusText}`);
      }
    
      // Get the content type of the response
      const contentType = response.headers.get('Content-Type') || '';
      console.log('Response content type:', contentType);
      
      let responseData;
      
      // Get the response text
      const text = await response.text();
      console.log('Received response from Google Apps Script');
      
      // Check if the response is HTML (which is a common issue with Google Apps Script)
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.error('Response is HTML, not valid data');
        console.error('Response text preview:', text.substring(0, 200));
        
        // Log more detailed information for debugging
        console.error('Content-Type header:', contentType);
        console.error('Response status:', response.status);
        console.error('URL used:', googleAppsScriptUrl);
        
        throw new Error('Google Apps Script returned HTML instead of data. This usually happens when the script is not properly deployed or configured. Please check your Google Apps Script deployment settings:\n1. Make sure it\'s deployed as a web app\n2. Set "Execute as" to "Me"\n3. Set "Who has access" to "Anyone"\n4. Make sure your script returns data in JSON or CSV format');
      }
      
      // Try to parse as JSON
      try {
        responseData = JSON.parse(text);
        console.log('Successfully parsed response as JSON');
      } catch (jsonParseError) {
        console.log('Response is not valid JSON, checking if it contains spreadsheet data');
        
        // Check if the response contains CSV or spreadsheet data
        if (text.includes(',') && text.split(',').length > 2) {
          console.log('Response appears to contain CSV data');
          responseData = { csvData: text, source: 'spreadsheet' };
        } else {
          // If we can't parse the response as JSON or CSV, provide a detailed error
          console.error('Unable to parse response as JSON or CSV');
          console.error('Response content type:', contentType);
          console.error('Response text preview:', text.substring(0, 200));
          throw new Error('Unable to get spreadsheet data: The response is not in JSON or CSV format. Please check your Google Apps Script code to ensure it returns data in the correct format.');
        }
      }
      
      // Process the response data based on what we received
      let formattedData;
      let source = 'api';
      
      if (responseData.csvData) {
        // We have CSV data from the spreadsheet
        console.log('Processing CSV data from spreadsheet');
        // Pass the CSV data to the client for parsing
        formattedData = { csvData: responseData.csvData };
        source = 'spreadsheet';
      } else if (responseData.rawData) {
        // We have raw HTML/text data
        console.log('Processing raw data response');
        // Just pass it through as is
        formattedData = [{ content: responseData.rawData, type: responseData.format }];
        source = 'html';
      } else if (responseData.data) {
        // We already have structured data (from mock or parsed JSON)
        formattedData = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
        source = responseData.source || 'api';
      } else {
        // Any other case, format the data appropriately
        formattedData = Array.isArray(responseData) ? responseData : [responseData];
      }
      
      // Return successful JSON response
      return new Response(
        JSON.stringify({ data: formattedData, source: source }),
        {
          status: 200,
          headers: headers,
        }
      );
    } catch (fetchError) {
      // Clear the timeout if there was a fetch error
      clearTimeout(timeoutId);
      console.error('Error fetching data from Google Apps Script:', fetchError);
      
      // Create a more helpful error message for the user
      let errorMessage = fetchError.message;
      
      // Add troubleshooting tips based on the error
      if (errorMessage.includes('HTML') || errorMessage.includes('DOCTYPE')) {
        errorMessage = 'The Google Apps Script is returning HTML instead of data. Please check your Google Apps Script deployment settings and make sure it returns JSON or CSV data.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Network error when connecting to Google Apps Script. Please check your internet connection and verify the Google Apps Script URL is correct and publicly accessible.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'The request to Google Apps Script timed out. The script may be taking too long to execute or is not responding.';
      }
      
      // Return error response without fallback data
      return new Response(
        JSON.stringify({ 
          error: errorMessage, 
          source: 'error',
          details: 'Please check your Google Apps Script configuration. Make sure it\'s deployed as a web app with "Execute as: Me" and "Who has access: Anyone".' 
        }),
        { status: 500, headers }
      );
    }
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    
    // Always return JSON even for errors
    return new Response(
      JSON.stringify({
        error: true,
        message: 'Failed to fetch Google Sheet data',
        details: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: headers,
      }
    );
  }
}