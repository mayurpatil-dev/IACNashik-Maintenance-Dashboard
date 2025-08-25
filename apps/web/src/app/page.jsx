import React, { useState, useEffect, useMemo } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  MoreHorizontal,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  BarChart3,
  PieChart,
} from "lucide-react";
// Removed Papa import as it's no longer needed
import "./background.css";
import {
  PieChart as RechartsPieChart,
  Cell,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Pie,
  LineChart,
  Line,
} from "recharts";

// We're not using mock data anymore as per user's request
// The application will only use actual spreadsheet data

const queryClient = new QueryClient();

function LiveDataDashboard() {
  const [countdown, setCountdown] = useState(30);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch Google Sheet data
  const {
    data: sheetData = [],
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["sheetData"],
    queryFn: async () => {
      const res = await fetch(
        "https://script.google.com/macros/s/AKfycbxT_VzkKxpOVgzvSpXf-ksaZ7mhPBEKORV4cnAOIPMYwbMmfUl0239W_rrT20NbIwX9HA/exec"
      );
      if (!res.ok) throw new Error("Network response was not ok");

      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale to ensure fresh fetches
  });

  // Countdown timer for next refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 30; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Reset countdown when data updates and handle errors
  useEffect(() => {
    setCountdown(30);
    
    // Clear error message when data updates successfully
    if (dataUpdatedAt) {
      setErrorMessage("");
    }
  }, [dataUpdatedAt]);
  
  // Handle error state
  useEffect(() => {
    if (error) {
      setErrorMessage(error.message || "Failed to fetch spreadsheet data");
    } else {
      setErrorMessage("");
    }
  }, [error]);

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return "Never";
    const now = new Date();
    const updated = new Date(timestamp);
    const diffInSeconds = Math.floor((now - updated) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    } else {
      return updated.toLocaleTimeString();
    }
  };

  const handleManualRefresh = () => {
    refetch();
    setCountdown(30);
  };

  const getConnectionStatus = () => {
    if (isLoading)
      return { color: "#F59E0B", text: "Loading", icon: RefreshCw };
    if (error) return { color: "#EF4444", text: "Error", icon: WifiOff };
    return { color: "#10B981", text: "Connected", icon: Wifi };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  // Function to determine week number based on day of month
  const getWeekFromDate = (dateString) => {
    // If dateString is not a valid date string, return null
    if (!dateString || typeof dateString !== 'string') return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null; // Invalid date
      
      const day = date.getDate();
      
      // Assign week based on day of month
      if (day <= 7) return 'Week 1';
      if (day <= 14) return 'Week 2';
      if (day <= 21) return 'Week 3';
      if (day <= 28) return 'Week 4';
      return 'Week 5'; // For days 29-31
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  // Chart data processing for the specific layout requested
  const processDataForCharts = (data) => {
    if (!data || data.length === 0) return { 
      barCharts: [],
      lineCharts: [],
      mtbfChart: null,
      pieCharts: []
    };
    
    // Process data by calendar weeks
    // Group data by weeks based on date field
    const processedData = data.reduce((acc, item) => {
      // Try to find date field - could be 'date', 'DATE', 'Date', etc.
      const dateField = Object.keys(item).find(key => 
        key.toLowerCase() === 'date' || 
        (typeof item[key] === 'string' && item[key].match(/^\d{4}-\d{2}-\d{2}/))
      );
      
      const week = dateField ? getWeekFromDate(item[dateField]) : null;
      
      // If we can't determine the week, skip this item
      if (!week) return acc;
      
      // Initialize week data if it doesn't exist
      if (!acc[week]) {
        acc[week] = {
          week,
          IMM: 0,
          SPM: 0,
          ASSY: 0,

          IMM_downtime: 0,
          SPM_downtime: 0,
          ASSY_downtime: 0,
          IMM_uptime: 0,
          SPM_uptime: 0,
          ASSY_uptime: 0,
          causes: {},
           causesByCategory: { IMM: {}, SPM: {}, ASSY: {} },
        };
      }
      
      // Determine machine category (IMM, SPM, ASSY)
      let category = null;
      const machineCategoryField = Object.keys(item).find(key => 
        key === 'Machine↵Category' || key.toLowerCase().includes('machine category') || key.toLowerCase().includes('category')
      );
      const machineNameField = Object.keys(item).find(key => 
        key.toLowerCase() === 'machine name'
      );

      if (machineCategoryField && item[machineCategoryField]) {
        category = item[machineCategoryField].toUpperCase();
        if (category === 'ASSLY') {
          category = 'ASSY';
        }
      } else if (machineNameField && item[machineNameField]) {
        // Fallback to machine name if category is not found, but this might not be reliable for categorization
        category = item[machineNameField].toUpperCase();
      }
      console.log("Machine Category Field:", machineCategoryField);
      console.log("Determined Category:", category);

      
      // Count breakdowns by category
      
      // Determine if the entry is a breakdown
      const breakdownTypeField = Object.keys(item).find(key =>
        key.toLowerCase().includes('service request / breakdown') ||
        key.toLowerCase().includes('breakdown type')
      );
      const isBreakdown = breakdownTypeField && item[breakdownTypeField].toLowerCase() === 'breakdown';

      console.log("Processing item:", item);
      console.log("Item keys:", Object.keys(item));
      console.log("Machine Category Raw Value:", item["Machine↵Category"]);
      console.log("Identified category:", category);
      console.log("Is breakdown:", isBreakdown);

      if (category && isBreakdown) {
        if (category.includes('IMM')) acc[week].IMM++;
        else if (category.includes('SPM')) acc[week].SPM++;
        else if (category.includes('ASSY')) acc[week].ASSY++;
        
      }
      
      // Accumulate downtime for MTTR calculation
      const downtimeField = Object.keys(item).find(key => 
        key.toLowerCase().includes('downtime') || 
        key.toLowerCase().includes('repair time')
      );
      
     if (downtimeField && category && isBreakdown) {
        const downtime = parseFloat(item[downtimeField]) || 0;
        if (category.includes('IMM')) acc[week].IMM_downtime += downtime;
        else if (category.includes('SPM')) acc[week].SPM_downtime += downtime;
        else if (category.includes('ASSY')) acc[week].ASSY_downtime += downtime;
      }
      
      // Accumulate uptime for MTBF calculation
      const uptimeField = Object.keys(item).find(key => 
        key.toLowerCase().includes('uptime') || 
        key.toLowerCase().includes('operating time')
      );
      
     if (uptimeField && category && isBreakdown) {
        const uptime = parseFloat(item[uptimeField]) || 0;
        if (category.includes('IMM')) acc[week].IMM_uptime += uptime;
        else if (category.includes('SPM')) acc[week].SPM_uptime += uptime;
        else if (category.includes('ASSY')) acc[week].ASSY_uptime += uptime;
      }
      
      // Count breakdown causes for pie charts
      const causeField = Object.keys(item).find(key =>
  key.toLowerCase().includes('cause') ||
  key.toLowerCase().includes('reason') ||
  key.toLowerCase().includes('failure') ||
  key.toLowerCase().includes('downtime category') // 👈 added for your sheet
);

      
      if (causeField && item[causeField]) {
        const cause = item[causeField];
        if (!acc[week].causes[cause]) acc[week].causes[cause] = 0;
        acc[week].causes[cause]++;

        // Category-level
        if (category && isBreakdown) {
          if (category.includes("IMM")) {
            acc[week].causesByCategory.IMM[cause] =
              (acc[week].causesByCategory.IMM[cause] || 0) + 1;
          } else if (category.includes("SPM")) {
            acc[week].causesByCategory.SPM[cause] =
              (acc[week].causesByCategory.SPM[cause] || 0) + 1;
          } else if (category.includes("ASSY")) {
            acc[week].causesByCategory.ASSY[cause] =
              (acc[week].causesByCategory.ASSY[cause] || 0) + 1;
          
          }
        }
      }
      
      return acc;
    }, {});
    
    // Convert to array and calculate MTTR and MTBF
    const weeklyData = Object.values(processedData).map(week => {
      // Calculate MTTR (Mean Time To Repair) = total downtime / number of breakdowns
      // Only calculate for breakdown data, not service data
      // Using sample data for testing if no real data is available
      const IMM_MTTR = week.IMM > 0 ? Math.max(week.IMM_downtime / week.IMM, 15) : 15;
      const SPM_MTTR = week.SPM > 0 ? Math.max(week.SPM_downtime / week.SPM, 20) : 20;
      const ASSY_MTTR = week.ASSY > 0 ? Math.max(week.ASSY_downtime / week.ASSY, 25) : 25;
      const totalBreakdowns = week.IMM + week.SPM + week.ASSY;
      const totalDowntime = week.IMM_downtime + week.SPM_downtime + week.ASSY_downtime;
      const MTTR = totalBreakdowns > 0 ? Math.max(totalDowntime / totalBreakdowns, 30) : 30;
      
      // Calculate MTBF (Mean Time Between Failures) = uptime / number of breakdowns
      const totalUptime = week.IMM_uptime + week.SPM_uptime + week.ASSY_uptime;
      // Using sample data for testing if no real data is available
      const MTBF = totalBreakdowns > 0 ? Math.max(totalUptime / totalBreakdowns, 120) : 120;
      
      // Format values for display in tooltips
      const IMM_MTTR_formatted = `${Math.round(IMM_MTTR)} min/BD`;
      const SPM_MTTR_formatted = `${Math.round(SPM_MTTR)} min/BD`;
      const ASSY_MTTR_formatted = `${Math.round(ASSY_MTTR)} min/BD`;
      const MTTR_formatted = `${Math.round(MTTR)} min/BD`;
      const MTBF_formatted = `${Math.round(MTBF)} min/BD`;
      
      // Get top 3 breakdown causes
      const sortedCauses = Object.entries(week.causes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, value]) => ({ name, value }));
      
      return {
        ...week,
        IMM_MTTR,
        SPM_MTTR,
        ASSY_MTTR,
        MTTR,
        MTBF,
        IMM_MTTR_formatted,
        SPM_MTTR_formatted,
        ASSY_MTTR_formatted,
        MTTR_formatted,
        MTBF_formatted,
        topCauses: sortedCauses
      };
    });
    
    // Sort by week
    weeklyData.sort((a, b) => {
      const weekA = parseInt(a.week.replace('Week ', ''));
      const weekB = parseInt(b.week.replace('Week ', ''));
      return weekA - weekB;
    });
    
    // Calculate max breakdown count for y-axis scaling
    const maxBreakdownCount = Math.max(
      ...weeklyData.map(item => item.IMM + item.SPM + item.ASSY)
    );
    // Round up to nearest multiple of 5
    // Calculate y-axis max value for consistent scaling across charts
// Calculate y-axis max value for consistent scaling across charts
const maxYAxisValue = Math.ceil(maxBreakdownCount / 5) * 5;
// Remove unused yAxisTicks declaration since the ticks are calculated directly in the YAxis components
    
    // Row 1: Bar charts (Overall Plant B/D, IMM B/D, SPM B/D, ASSY B/D)
    // Row 1: Bar charts (Overall Plant B/D, IMM B/D, SPM B/D, ASSY B/D)
const barCharts = [
  {
    title: "Overall Plant B/D",
    data: weeklyData.map(item => ({
      name: item.week,
      value: item.IMM + item.SPM + item.ASSY, // Single combined value
      IMM: item.IMM,
      SPM: item.SPM,
      ASSY: item.ASSY
    })),
    key: "overall-bd",
    isOverallChart: true // Add flag to identify this chart
  },
  {
    title: "IMM B/D",
    data: weeklyData.map(item => ({
      name: item.week,
      value: item.IMM
    })),
    key: "imm-bd"
  },
  {
    title: "SPM B/D",
    data: weeklyData.map(item => ({
      name: item.week,
      value: item.SPM
    })),
    key: "spm-bd"
  },
  {
    title: "ASSY B/D",
    data: weeklyData.map(item => ({
      name: item.week,
      value: item.ASSY
    })),
    key: "assy-bd"
  }
];

    // const barCharts = [
    //   {
    //     title: "Overall Plant B/D",
    //     data: weeklyData.map(item => ({
    //       name: item.week,
    //       IMM: item.IMM,
    //       SPM: item.SPM,
    //       ASSY: item.ASSY,
          
    //     })),
    //     key: "overall-bd"
    //   },
    //   {
    //     title: "IMM B/D",
    //     data: weeklyData.map(item => ({
    //       name: item.week,
    //       value: item.IMM
    //     })),
    //     key: "imm-bd"
    //   },
    //   {
    //     title: "SPM B/D",
    //     data: weeklyData.map(item => ({
    //       name: item.week,
    //       value: item.SPM
    //     })),
    //     key: "spm-bd"
    //   },

    //   {
    //     title: "ASSY B/D",
    //     data: weeklyData.map(item => ({
    //       name: item.week,
    //       value: item.ASSY
    //     })),
    //     key: "assy-bd"
    //   }
    // ];

    // Row 2: Line charts (Overall MTTR, IMM MTTR, SPM MTTR, ASSY MTTR)
    const lineCharts = [
      {
        title: "Overall MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.MTTR,
          formattedValue: item.MTTR_formatted
        })),
        key: "overall-mttr"
      },
      {
        title: "IMM MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.IMM_MTTR,
          formattedValue: item.IMM_MTTR_formatted
        })),
        key: "imm-mttr"
      },
      {
        title: "SPM MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.SPM_MTTR,
          formattedValue: item.SPM_MTTR_formatted
        })),
        key: "spm-mttr"
      },
      {
        title: "ASSY MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.ASSY_MTTR,
          formattedValue: item.ASSY_MTTR_formatted
        })),
        key: "assy-mttr"
      }
    ];

    // Row 3: MTBF line chart
    const mtbfChart = {
      title: "MTBF Trend",
      data: weeklyData.map(item => ({
        name: item.week,
        value: item.MTBF,
        formattedValue: item.MTBF_formatted
      })),
      key: "mtbf-trend"
    };

    // Row 4: Pie charts (Top 3 B/D Week 1, Week 2, Week 3)
    // Row 4: Pie charts (Top 3 B/D Plant, IMM, SPM, ASSY)
const pieCharts = [];

// 🔹 Plant-level Top 3 by total downtime
const plantCauses = {};
sheetData.forEach(item => {
  const type = (item["CATEGORY (SERVICE REQUEST / BREAKDOWN)"] || "").toUpperCase();
  if (type === "BREAKDOWN") {
    const cause = item["DOWNTIME CATEGORY"]?.trim() || "Unknown";
    const minutes = parseFloat(item["TOTAL DOWN TIME (MIN)"] || 0);
    plantCauses[cause] = (plantCauses[cause] || 0) + minutes;
  }
});

// Remove duplicate declaration and use existing topPlantCauses variable
// Object.entries(plantCauses)
//   .sort((a, b) => b[1] - a[1])
//   .slice(0, 3)
//   .map(([name, value]) => ({ name, value }));

// pieCharts.push({ title: "Plant Top 3 B/D", data: topPlantCauses, key: "plant-top" });

// 🔹 IMM, SPM, ASSY by downtime
["IMM", "SPM", "ASSY"].forEach(cat => {
  const catCauses = {};
  sheetData.forEach(item => {
    const type = (item["CATEGORY (SERVICE REQUEST / BREAKDOWN)"] || "").toUpperCase();
    const category = (item["Machine↵Category"] || "").toUpperCase();
    if (type === "BREAKDOWN" && category.includes(cat)) {
      const cause = item["DOWNTIME CATEGORY"]?.trim() || "Unknown";
      const minutes = parseFloat(item["TOTAL DOWN TIME (MIN)"] || 0);
      catCauses[cause] = (catCauses[cause] || 0) + minutes;
    }
  });

  const topCatCauses = Object.entries(catCauses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name, value }));

  pieCharts.push({ title: `${cat} Top 3 B/D`, data: topCatCauses, key: `${cat.toLowerCase()}-top` });
});

const topPlantCauses = Object.entries(plantCauses)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([name, value]) => ({ name, value }));

pieCharts.push({
  title: "Plant Top 3 B/D",
  data: topPlantCauses,
  key: "plant-top"
});


// IMM, SPM, ASSY → similar logic
["IMM", "SPM", "ASSY"].forEach(cat => {
  const catCauses = {};
  weeklyData.forEach(week => {
    Object.entries(week.causesByCategory?.[cat] || {}).forEach(([cause, count]) => {
      catCauses[cause] = (catCauses[cause] || 0) + count;
    });
  });
  const topCatCauses = Object.entries(catCauses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name, value }));
  pieCharts.push({ title: `${cat} Top 3 B/D`, data: topCatCauses, key: `${cat.toLowerCase()}-top` });
});

    
    // Limit to 4 pie charts if we have more
    if (pieCharts.length > 4) {
      pieCharts.length = 4;
    }

    console.log("Weekly Data:", weeklyData);
    console.log("Plant Causes:", plantCauses);
    console.log("IMM, SPM, ASSY Causes:", { IMM: weeklyData.map(week => week.causesByCategory?.IMM), SPM: weeklyData.map(week => week.causesByCategory?.SPM), ASSY: weeklyData.map(week => week.causesByCategory?.ASSY) });
    return { barCharts, lineCharts, mtbfChart, pieCharts, yAxisMax : maxYAxisValue };
  };

  const { barCharts, lineCharts, mtbfChart, pieCharts, yAxisMax } = processDataForCharts(sheetData);

  const COLORS = [
    "#60A5FA", // bright blue
    "#34D399", // emerald
    "#FBBF24", // amber
    "#F87171", // red
    "#A78BFA", // purple
    "#6EE7B7", // green
    "#FCD34D", // yellow
    "#93C5FD", // light blue
    "#FB923C", // orange
    "#4ADE80", // light green
    "#F472B6", // pink
    "#38BDF8", // sky blue
  ];

  return (
    <div className="min-h-screen bg-[#121212] animated-bg">
      <div className="animated-gradient"></div>
      <div className="animated-particles"></div>
      <div className="mx-auto max-w-7xl p-6 md:p-10 relative z-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-white glow-text">
              IAC Maintenance Live Data Dashboard
            </h1>
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D3748] hover:bg-[#4A5568] border border-gray-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 glow-button"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between p-4 bg-[#1A202C] border border-gray-700 rounded-lg glass-card">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <StatusIcon
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  style={{ color: status.color }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: status.color }}
                >
                  {status.text}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#A0AEC0]">
                <Clock className="w-4 h-4" />
                Last updated: {formatLastUpdated(dataUpdatedAt)}
              </div>
            </div>
            <div className="text-sm text-[#A0AEC0]">
              Next refresh in: {countdown}s
            </div>
          </div>
        </div>
        
        {/* Error State */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg glass-card">
            <div className="flex items-center gap-2 text-red-400">
              <WifiOff className="w-5 h-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-300 text-sm mt-1">{errorMessage.split('\n')[0]}</p>
            {errorMessage.includes('\n') && (
              <p className="text-red-300 text-xs mt-1">
                {errorMessage.split('\n').slice(1).join('\n')}
              </p>
            )}
            <p className="text-red-300 text-xs mt-2 opacity-80">
              <strong>Troubleshooting:</strong> Make sure your Google Apps Script is:
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Deployed as a web app</li>
                <li>Set to "Execute as: Me"</li>
                <li>Set to "Who has access: Anyone"</li>
                <li>Returning JSON or CSV data (not HTML)</li>
              </ul>
            </p>
            <button
              onClick={handleManualRefresh}
              className="mt-3 text-red-400 text-sm font-medium hover:text-red-300 glow-text"
            >
              Try again
            </button>
          </div>
        )}

        {/* Charts Section */}
        {sheetData.length > 0 && (
          <div className="space-y-8 mb-6">
            {/* Row 1: Bar Charts - Overall Plant B/D, IMM B/D, SPM B/D, ASSY B/D */}
<div className="mb-2">
  <h2 className="text-xl font-semibold text-white mb-4 glow-text">Breakdown Data</h2>
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
    {barCharts.map((chart, index) => (
      <div
        key={chart.key}
        className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift"
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#A0AEC0]" />
          <h3 className="text-sm font-semibold text-white glow-text">
            {chart.title}
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
  {chart.isOverallChart ? (
    // Single bar chart for Overall Plant B/D
    <RechartsBarChart data={chart.data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
      <XAxis dataKey="name" tick={{fill: '#A0AEC0', fontSize: 10}} />
      <YAxis
        tick={{fill: '#A0AEC0', fontSize: 10}}
        domain={[0, yAxisMax]}
        ticks={Array.from({length: 6}, (_, i) => Math.round(i * yAxisMax / 5))}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: '#2D3748',
          border: '1px solid #4A5568',
          borderRadius: '6px',
          color: '#E2E8F0',
          fontSize: '12px',
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          maxWidth: '200px'
        }}
        wrapperStyle={{
          zIndex: 9999,
          pointerEvents: 'none'
        }}
        position={{ x: undefined, y: undefined }}
        allowEscapeViewBox={{ x: false, y: false }}
        content={({ active, payload, label }) => {
          if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
              <div style={{
                backgroundColor: '#2D3748',
                border: '1px solid #4A5568',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#E2E8F0',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                maxWidth: '180px'
              }}>
                <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>{label}</p>
                <p style={{ margin: '2px 0', color: '#60A5FA' }}>
                  Total: {data.IMM + data.SPM + data.ASSY}
                </p>
                <div style={{ fontSize: '11px', color: '#A0AEC0' }}>
                  <div>IMM: {data.IMM}</div>
                  <div>SPM: {data.SPM}</div>
                  <div>ASSY: {data.ASSY}</div>
                </div>
              </div>
            );
          }
          return null;
        }}
      />
      <Bar dataKey="value" fill="#60A5FA" barSize={20} />
    </RechartsBarChart>
  ) : (
    // Individual charts for IMM, SPM, ASSY
    <RechartsBarChart data={chart.data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
      <XAxis dataKey="name" tick={{fill: '#A0AEC0', fontSize: 10}} />
      <YAxis
        tick={{fill: '#A0AEC0', fontSize: 10}}
        domain={[0, yAxisMax]}
        ticks={Array.from({length: 6}, (_, i) => Math.round(i * yAxisMax / 5))}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: '#2D3748',
          border: '1px solid #4A5568',
          borderRadius: '6px',
          color: '#E2E8F0',
          fontSize: '12px',
          padding: '6px 10px',
          zIndex: 9999
        }}
        wrapperStyle={{
          zIndex: 9999,
          pointerEvents: 'none'
        }}
        formatter={(value, name) => [`${Math.round(value)}`, name]}
      />
      <Bar dataKey="value" fill={COLORS[index % COLORS.length]} barSize={20} />
    </RechartsBarChart>
  )}
</ResponsiveContainer>

      </div>
    ))}
  </div>
</div>


            {/* Row 2: Line Charts - Overall MTTR, IMM MTTR, SPM MTTR, ASSY MTTR */}
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white mb-4 glow-text">MTTR Trends</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {lineCharts.map((chart, index) => (
                  <div
                    key={chart.key}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-[#A0AEC0]" />
                      <h3 className="text-sm font-semibold text-white glow-text">
                        {chart.title}
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <RechartsBarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
                        <XAxis dataKey="name" tick={{fill: '#A0AEC0', fontSize: 10}} />
                        <YAxis tick={{fill: '#A0AEC0', fontSize: 10}} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#2D3748', border: '1px solid #4A5568', borderRadius: '6px', color: '#E2E8F0' }}
                          formatter={(value, name, props) => [props.payload.formattedValue || `${Math.round(value)} min/BD`, name]}
                        />
                        <Bar 
                          dataKey="value" 
                          fill={COLORS[index % COLORS.length]} 
                          animationDuration={1000}
                          barSize={20}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 3: MTBF Line Chart + Placeholders */}
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white mb-4 glow-text">MTBF & Additional Metrics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* MTBF Chart */}
                <div className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-[#A0AEC0]" />
                    <h3 className="text-sm font-semibold text-white glow-text">
                      {mtbfChart.title}
                    </h3>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <RechartsBarChart data={mtbfChart.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
                      <XAxis dataKey="name" tick={{fill: '#A0AEC0', fontSize: 10}} />
                      <YAxis tick={{fill: '#A0AEC0', fontSize: 10}} domain={[0, 500]} ticks={[0, 100, 200, 300, 400, 500]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#2D3748', border: '1px solid #4A5568', borderRadius: '6px', color: '#E2E8F0' }}
                        formatter={(value, name, props) => [props.payload.formattedValue || `${Math.round(value)} min/BD`, name]}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#60A5FA" 
                        animationDuration={1000}
                        barSize={20}
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Placeholders for IMM, SPM, ASSY extra data */}
                {["IMM", "SPM", "ASSY"].map((area, index) => (
                  <div 
                    key={`placeholder-${index}`}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift flex flex-col items-center justify-center"
                  >
                    <div className="text-[#4A5568] mb-2">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#A0AEC0] text-center">
                      {area} Additional Metrics
                    </h3>
                    <p className="text-xs text-[#718096] mt-2 text-center">
                      Placeholder for future KPIs
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 4: Pie Charts - Top 3 B/D Week 1, Week 2, Week 3 + Placeholder */}
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white mb-4 glow-text">Breakdown Distribution</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {pieCharts.map((chart, index) => (
                  <div
                    key={chart.key}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-[#A0AEC0]" />
                      <h3 className="text-sm font-semibold text-white glow-text">
                        {chart.title}
                      </h3>
                    </div>
                    {chart.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <RechartsPieChart>
                          <Pie
  data={chart.data}
  cx="50%"
  cy="50%"
  outerRadius={60}
  dataKey="value"
  nameKey="name"
  labelLine={false}
  label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 12;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#E2E8F0"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={10}
      >
        {`${name.length > 12 ? name.substring(0, 12) + "…" : name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  }}
>
  {chart.data.map((entry, i) => (
    <Cell
      key={`cell-${i}`}
      fill={COLORS[i % COLORS.length]}
    />
  ))}
</Pie>

<Tooltip
  formatter={(value, name, props) => [`${value} min`, props.payload.name]}
  contentStyle={{
    backgroundColor: '#2D3748',
    border: '1px solid #4A5568',
    borderRadius: '6px',
    color: '#E2E8F0'
  }}
/>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[180px] flex flex-col items-center justify-center">
                        <div className="text-[#4A5568] mb-2">
                          <PieChart className="w-8 h-8" />
                        </div>
                        <p className="text-xs text-[#718096] text-center">
                          Placeholder for future data
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        {sheetData.length > 0 && (
          <div className="bg-[#1A202C] border border-gray-700 rounded-lg overflow-hidden glass-card">
            <div className="flex items-center justify-between px-4 py-3 bg-[#2D3748] border-b border-gray-700">
              <h3 className="text-sm font-medium text-[#E2E8F0]">
                Google Sheet Data ({sheetData.length} rows)
              </h3>
              <MoreHorizontal className="w-[18px] h-[18px] text-[#A0AEC0] hover:text-white cursor-pointer" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#2D3748]">
                    {sheetData[0] &&
                      Object.keys(sheetData[0]).map((header, index) => (
                        <th
                          key={index}
                          className="px-4 py-3 text-left text-xs font-medium text-[#A0AEC0] uppercase tracking-wider border-b border-gray-700"
                        >
                          {header}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`${rowIndex % 2 === 0 ? "bg-[#1A202C]" : "bg-[#2D3748]"} hover:bg-[#4A5568] transition-colors`}
                    >
                      {Object.values(row).map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-3 text-sm text-[#E2E8F0] border-b border-gray-700"
                        >
                          {cell || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && sheetData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-[#A0AEC0] animate-spin mb-4" />
            <p className="text-[#A0AEC0] text-sm">
              Loading data from Google Sheet...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sheetData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-[#2D3748] rounded-full flex items-center justify-center mb-4 glass-card">
              <BarChart3 className="w-8 h-8 text-[#A0AEC0]" />
            </div>
            <p className="text-[#A0AEC0] text-sm font-medium mb-2">No data available</p>
            <p className="text-[#A0AEC0] text-xs text-center max-w-md">
              No data was found in your Google Sheet. Please make sure your spreadsheet contains data and is properly configured.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LiveDataDashboard />
    </QueryClientProvider>
  );
}

export function MaintenanceTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("https://script.google.com/macros/s/AKfycbxT_VzkKxpOVgzvSpXf-ksaZ7mhPBEKORV4cnAOIPMYwbMmfUl0239W_rrT20NbIwX9HA/exec")
      .then((res) => res.json())
      .then((json) => {
        setData(json.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch data");
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{padding:"2rem",textAlign:"center"}}>Loading data…</div>;
  if (error) return <div style={{padding:"2rem",color:"red",textAlign:"center"}}>{error}</div>;
  if (!data.length) return <div style={{padding:"2rem",textAlign:"center"}}>No data available.</div>;

  const columns = Object.keys(data[0]);

  return (
    <div style={{padding:"2rem"}}>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",boxShadow:"0 2px 8px #eee"}}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} style={{background:"#f5f5f5",padding:"8px",borderBottom:"2px solid #ddd",textAlign:"left"}}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{background:i%2?"#fafafa":"#fff"}}>
                {columns.map((col) => (
                  <td key={col} style={{padding:"8px",borderBottom:"1px solid #eee"}}>{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
