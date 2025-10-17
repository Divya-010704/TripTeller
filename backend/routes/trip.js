const express = require('express');
const router = express.Router();

// Map of state names to default cities
const stateToCity = {
  'kerala': 'Kochi',
  'tamil nadu': 'Chennai',
  'karnataka': 'Bengaluru',
  'maharashtra': 'Mumbai',
  'rajasthan': 'Jaipur',
  'uttar pradesh': 'Lucknow',
  'telangana': 'Hyderabad',
  'andhra pradesh': 'Vijayawada',
  'gujarat': 'Ahmedabad',
  'punjab': 'Amritsar',
  'west bengal': 'Kolkata',
  'madhya pradesh': 'Bhopal',
  'odisha': 'Bhubaneswar',
  'bihar': 'Patna',
  'assam': 'Guwahati',
  'goa': 'Panaji',
  'haryana': 'Gurgaon',
  'chhattisgarh': 'Raipur',
  'jharkhand': 'Ranchi',
  'uttarakhand': 'Dehradun',
  'himachal pradesh': 'Shimla',
  'tripura': 'Agartala',
  'manipur': 'Imphal',
  'meghalaya': 'Shillong',
  'mizoram': 'Aizawl',
  'nagaland': 'Kohima',
  'sikkim': 'Gangtok',
  'arunachal pradesh': 'Itanagar'
};

// Main trip planner endpoint
router.post('/plan', async (req, res) => {
  try {
    let { startLocation, destination, days, budget, travelers } = req.body;
    if (!startLocation || !destination || !days || !budget) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const numDays = parseInt(days);
    const numTravelers = parseInt(travelers) || 1;
    // Sample/mock data for demonstration
    const sampleAttractions = [
      { name: 'Baga Beach', type: 'Beach', description: 'Popular beach for water sports and nightlife.' },
      { name: 'Dudhsagar Falls', type: 'Waterfall', description: 'Scenic four-tiered waterfall.' },
      { name: 'Aguada Fort', type: 'Fort', description: 'Historic fort with sea views.' },
      { name: 'Casino Cruise', type: 'Entertainment', description: 'Floating casino experience.' }
    ];
    const sampleRoutes = [
      { mode: 'Bus', duration: '12h', distance: '600 km', cost: 1200 },
      { mode: 'Train', duration: '10h', distance: '600 km', cost: 1500 },
      { mode: 'Cab', duration: '9h', distance: '600 km', cost: 7000 },
      { mode: 'Flight', duration: '2h', distance: '600 km', cost: 4000 }
    ];
    const sampleStay = [
      { type: 'Budget', name: 'Goa Hostel', costPerNight: 600 },
      { type: 'Standard', name: 'Goa Comfort Hotel', costPerNight: 2000 },
      { type: 'Luxury', name: 'Goa Beach Resort', costPerNight: 8000 }
    ];
    const sampleFood = [
      { type: 'Budget', avgMeal: 200, mustTry: ['Goan Fish Curry', 'Prawn Balchao'] },
      { type: 'Mid-range', avgMeal: 500, mustTry: ['Chicken Cafreal', 'Bebinca'] },
      { type: 'Premium', avgMeal: 1500, mustTry: ['Seafood Platter', 'Feni'] }
    ];
    const sampleWeather = {
      temperature: '29°C',
      condition: 'Humid, Chance of rain showers',
      humidity: '80%'
    };
    // Budget breakdown calculation
    const travelCost = sampleRoutes[1].cost * numTravelers; // Assume train for demo
    const stayCost = sampleStay[1].costPerNight * numDays * numTravelers; // Standard
    const foodCost = sampleFood[1].avgMeal * 3 * numDays * numTravelers; // Mid-range
    const activitiesCost = 3000; // Sample
    const miscCost = 2000; // Sample
    const total = travelCost + stayCost + foodCost + activitiesCost + miscCost;
    const budgetBreakdown = {
      travel: travelCost,
      stay: stayCost,
      food: foodCost,
      activities: activitiesCost,
      misc: miscCost,
      total
    };
    res.json({
      attractions: sampleAttractions,
      routes: sampleRoutes,
      stay: sampleStay,
      food: sampleFood,
      weather: sampleWeather,
      budgetBreakdown,
      suggestion: '',
      startLocation,
      destination,
      days: numDays,
      travelers: numTravelers,
      budget: parseInt(budget)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
