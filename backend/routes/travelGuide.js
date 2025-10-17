
const express = require('express');
const axios = require('axios');
const router = express.Router();

// @route   POST /api/travel-guide
// @desc    Get complete travel guide (live data)
// @access  Public


router.post('/', async (req, res) => {
    // Mock accommodation data (replace with real API if available)
    let accommodation = [
      {
        type: 'Hotel',
        name: 'Sample Hotel',
        costPerNight: 1200
      }
    ];
  const { start, destination, days, budget, travelers } = req.body;
  try {

    // Geocode start and destination using Nominatim
    const geocode = async (place) => {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: place, format: 'json', limit: 1 }
      });
      if (res.data && res.data[0]) {
        return {
          lat: parseFloat(res.data[0].lat),
          lon: parseFloat(res.data[0].lon)
        };
      } else {
        throw new Error('Location not found: ' + place);
      }
    };

    const startLoc = await geocode(start);
    const destLoc = await geocode(destination);

    // Helper to check if a location is routable (by trying a small ORS request)
    async function isRoutable(loc) {
      try {
        const orsApiKey = process.env.ORS_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImQwNmM4ODE3MjE4YzRhMjRiMzM0N2MxZWUxMTIxZWVlIiwiaCI6Im11cm11cjY0In0=';
        const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';
        await axios.post(orsUrl, {
          coordinates: [
            [loc.lon, loc.lat],
            [loc.lon + 0.01, loc.lat + 0.01] // small offset
          ]
        }, {
          headers: {
            Authorization: orsApiKey,
            'Content-Type': 'application/json'
          }
        });
        return true;
      } catch (e) {
        return false;
      }
    }

    // If destination is not routable, return a user-friendly error
    const routable = await isRoutable(destLoc);
    if (!routable) {
      return res.status(400).json({
        error: 'Destination is too broad or not routable. Please enter a more specific city, town, or landmark.'
      });
    }

    // OpenRouteService API for accurate distance and travel time
    const orsApiKey = process.env.ORS_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImQwNmM4ODE3MjE4YzRhMjRiMzM0N2MxZWUxMTIxZWVlIiwiaCI6Im11cm11cjY0In0=';
    if (!orsApiKey) throw new Error('OpenRouteService API key not set in environment');
    const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const orsRes = await axios.post(orsUrl, {
      coordinates: [
        [startLoc.lon, startLoc.lat],
        [destLoc.lon, destLoc.lat]
      ]
    }, {
      headers: {
        Authorization: orsApiKey,
        'Content-Type': 'application/json'
      }
    });
    if (!orsRes.data.routes || !orsRes.data.routes[0]) {
      console.error('ORS API response:', orsRes.data);
      return res.status(400).json({
        error: 'No route found. Please check your start and destination values.',
        apiError: orsRes.data
      });
    }
    const orsRoute = orsRes.data.routes[0];
    const distance_km = orsRoute.summary.distance / 1000;
    const duration_hr = orsRoute.summary.duration / 3600;

    // Nominatim for nearby attractions (tourism=attraction)
    const viewbox = [
      destLoc.lon - 0.1,
      destLoc.lat + 0.1,
      destLoc.lon + 0.1,
      destLoc.lat - 0.1
    ].join(',');
    // Attractions
    const attractionsRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: 'tourist attractions',
        format: 'json',
        limit: 5,
        viewbox,
        bounded: 1
      }
    });
    const attractions = (attractionsRes.data || []).map(place => ({
      name: place.display_name,
      type: 'Attraction',
      distance_km: null,
      description: place.type || ''
    }));



    // Mock data for restaurants/food options
    const food_options = [
      { type: 'Restaurant', name: 'Spice Villa', address: 'Downtown', rating: 4.2, avgMeal: 350 },
      { type: 'Restaurant', name: 'Tasty Treats', address: 'Near Park', rating: 4.0, avgMeal: 250 },
      { type: 'Restaurant', name: 'Local Flavors', address: 'Old Town', rating: 4.3, avgMeal: 300 },
      { type: 'Café', name: 'Coffee Corner', address: 'Mall Road', rating: 4.5, avgMeal: 200 },
      { type: 'Diner', name: 'Family Diner', address: 'Station Road', rating: 3.9, avgMeal: 280 }
    ];

    // OpenWeather API (unchanged)
    const weatherRes = await axios.get(
      'https://api.openweathermap.org/data/2.5/weather',
      {
        params: {
          q: destination,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric'
        }
      }
    );
    const weather = {
      temperature_c: weatherRes.data.main.temp,
      condition: weatherRes.data.weather[0].description,
      humidity_percent: weatherRes.data.main.humidity,
      advice: weatherRes.data.weather[0].main.toLowerCase().includes('rain') ? 'Carry an umbrella' : 'Have a great trip!'
    };


    // Geoapify Places API for accurate nearby places (attractions, restaurants, shops, hotels)
    let geoapify_places = [];
    const geoapifyKey = '83c35f5be56c43f3ad2b9858aa8b6712';
    const geoapifyUrl = `https://api.geoapify.com/v2/places`;
    const categories = [
      'tourism.sights',
      'catering.restaurant',
      'commercial.shopping_mall',
      'accommodation.hotel'
    ];
    // Try main request, then fallback to broader, then fallback to mock data
    try {
      const geoapifyRes = await axios.get(geoapifyUrl, {
        params: {
          categories: categories.join(','),
          filter: `circle:${destLoc.lon},${destLoc.lat},10000`,
          limit: 30,
          apiKey: geoapifyKey
        }
      });
      geoapify_places = (geoapifyRes.data.features || []).map(f => ({
        name: f.properties.name || f.properties.address_line1 || 'Unknown',
        category: f.properties.categories ? f.properties.categories[0] : '',
        address: f.properties.address_line2 || '',
        distance: f.properties.distance || null,
        website: f.properties.website || '',
        kinds: f.properties.kinds || '',
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0]
      }));
      // If not enough places, try without category filter
      if (geoapify_places.length < 5) {
        const broadRes = await axios.get(geoapifyUrl, {
          params: {
            filter: `circle:${destLoc.lon},${destLoc.lat},20000`,
            limit: 30,
            apiKey: geoapifyKey
          }
        });
        geoapify_places = geoapify_places.concat((broadRes.data.features || []).map(f => ({
          name: f.properties.name || f.properties.address_line1 || 'Unknown',
          category: f.properties.categories ? f.properties.categories[0] : '',
          address: f.properties.address_line2 || '',
          distance: f.properties.distance || null,
          website: f.properties.website || '',
          kinds: f.properties.kinds || '',
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0]
        })));
      }
    } catch (geoapifyErr) {
      console.error('Geoapify API error:', geoapifyErr.message);
      // Fallback: always return some mock places if Geoapify fails
      geoapify_places = [
        {
          name: 'Central Park',
          category: 'park',
          address: 'Main Road',
          distance: 500,
          website: '',
          kinds: 'park',
          lat: destLoc.lat,
          lon: destLoc.lon
        },
        {
          name: 'City Museum',
          category: 'museum',
          address: 'Museum Street',
          distance: 1200,
          website: '',
          kinds: 'museum',
          lat: destLoc.lat,
          lon: destLoc.lon
        },
        {
          name: 'Popular Restaurant',
          category: 'restaurant',
          address: 'Food Lane',
          distance: 800,
          website: '',
          kinds: 'restaurant',
          lat: destLoc.lat,
          lon: destLoc.lon
        }
      ];
    }

  // Budget breakdown (use live hotel/food data if available)
  // Travel options (mock logic for India)
  const numTravelers = travelers || 1;
  const carCost = Math.round(distance_km * 6);
  const busCost = Math.round(distance_km * 2);
  const trainCost = Math.round(distance_km * 1.5);
  const flightCost = distance_km > 200 ? Math.round(5000 + distance_km * 7) : 5000;

  const carDuration = duration_hr;
  const busDuration = +(carDuration * 1.2).toFixed(1);
  const trainDuration = +(carDuration * 0.8).toFixed(1);
  const flightDuration = +(distance_km / 500 + 2).toFixed(1);

  const travelOptions = [
    {
      mode: 'Car',
      costPerPerson: carCost,
      costTotal: carCost * numTravelers,
      details: `Driving: ${distance_km.toFixed(1)} km, ${carDuration.toFixed(1)} hrs | ₹${carCost}/person, ₹${carCost * numTravelers} total for ${numTravelers} travelers`
    },
    {
      mode: 'Bus',
      costPerPerson: busCost,
      costTotal: busCost * numTravelers,
      details: `Bus: ${distance_km.toFixed(1)} km, ${busDuration} hrs | ₹${busCost}/person, ₹${busCost * numTravelers} total for ${numTravelers} travelers`
    },
    {
      mode: 'Train',
      costPerPerson: trainCost,
      costTotal: trainCost * numTravelers,
      details: `Train: ${distance_km.toFixed(1)} km, ${trainDuration} hrs | ₹${trainCost}/person, ₹${trainCost * numTravelers} total for ${numTravelers} travelers`
    },
    {
      mode: 'Flight',
      costPerPerson: flightCost,
      costTotal: flightCost * numTravelers,
      details: `Flight: ${distance_km.toFixed(1)} km, ${flightDuration} hrs | ₹${flightCost}/person, ₹${flightCost * numTravelers} total for ${numTravelers} travelers`
    }
  ];

  // Use car cost for budget breakdown (can be improved to let user pick mode)
  const travelCost = carCost;
  const stayCost = accommodation.length > 0 ? accommodation[0].costPerNight * days : 1200 * days;
  const foodCost = food_options.length > 0 ? food_options[0].avgMeal * days * travelers : 300 * days * travelers;
  const activitiesCost = 1000;
  const miscCost = 1000;
  const total = travelCost + stayCost + foodCost + activitiesCost + miscCost;

  // Debug: print travel options to verify costPerPerson and costTotal
  console.log('Travel options:', travelOptions);
  res.json({
    startCoords: { lat: parseFloat(startLoc.lat), lon: parseFloat(startLoc.lon) },
    endCoords: { lat: parseFloat(destLoc.lat), lon: parseFloat(destLoc.lon) },
    route: {
      distance_km,
      duration_hr,
      geometry: [],
      options: travelOptions
    },
    nearby_places: attractions,
    geoapify_places,
  accommodation,
    food_options,
    budget_breakdown: {
      travel: travelCost,
      stay: stayCost,
      food: foodCost,
      activities: activitiesCost,
      misc: miscCost,
      total
    },
    weather
  });
  } catch (err) {
    console.error('Travel Guide API error:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
      console.error('Response status:', err.response.status);
      res.status(500).json({
        error: 'Failed to fetch live data',
        details: err.message,
        apiError: err.response.data
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch live data',
        details: err.message
      });
    }
  }
});

module.exports = router;
