const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Load environment variables
require('dotenv').config();
// Debug: Print Google API Key (should NOT be undefined)
console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY);

const tripRoutes = require('./routes/trips');
const tripPlannerRoute = require('./routes/trip');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');

const travelGuideRoute = require('./routes/travelGuide');
const destinationsRoute = require('./routes/destinations');
const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));


app.use('/api/trips', tripRoutes);
app.use('/api/trip', tripPlannerRoute);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

app.use('/api/travel-guide', travelGuideRoute);
app.use('/api/destinations', destinationsRoute);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
