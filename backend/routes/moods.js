const express = require('express');
const router = express.Router();

// Example in-memory data. Replace with DB queries in production.
const destinations = [
  { id: 'manali', name: 'Manali', image: '/images/manali.jpg', description: 'Perfect for trekking, camping, and adventure sports.', moods: ['Adventurous'], tips: 'Best time: May-June. Carry warm clothes.' },
  { id: 'rishikesh', name: 'Rishikesh', image: '/images/rishikesh.jpg', description: 'Rafting and spiritual vibes.', moods: ['Adventurous', 'Cultural/Spiritual'], tips: 'Try river rafting.' },
  { id: 'goa', name: 'Goa', image: '/images/goa.jpg', description: 'Beaches and parties.', moods: ['Relaxing', 'Party/Fun'], tips: 'Best time: Nov-Feb.' },
  { id: 'kerala', name: 'Kerala Backwaters', image: '/images/kerala.jpg', description: 'Relaxing houseboats and nature.', moods: ['Relaxing'], tips: 'Try a houseboat stay.' },
  { id: 'shimla', name: 'Shimla', image: '/images/shimla.jpg', description: 'Romantic hill station.', moods: ['Romantic'], tips: 'Visit in winter for snow.' },
  { id: 'varanasi', name: 'Varanasi', image: '/images/varanasi.jpg', description: 'Spiritual city on the Ganges.', moods: ['Cultural/Spiritual'], tips: 'Attend Ganga Aarti.' },
  { id: 'mumbai', name: 'Mumbai', image: '/images/mumbai.jpg', description: 'Nightlife and festivals.', moods: ['Party/Fun'], tips: 'Visit Marine Drive.' },
  { id: 'mysore', name: 'Mysore', image: '/images/mysore.jpg', description: 'Family-friendly palaces and parks.', moods: ['Family-Friendly'], tips: 'See Mysore Palace.' }
];

router.get('/:mood', (req, res) => {
  const mood = req.params.mood;
  const filtered = destinations.filter(dest => dest.moods.includes(mood));
  res.json({ destinations: filtered });
});

module.exports = router;
