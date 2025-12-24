const axios = require('axios');
const { password, select } = require('@inquirer/prompts');
const { create } = require('xmlbuilder2');
const fs = require('fs');

const OURA_BASE_URL = 'https://api.ouraring.com/v2/usercollection';

/**
 * Main execution flow
 */
async function run() {
  try {
    // 1. Prompt for OAuth Token
    const token = await password({
      message: 'Enter your Oura OAuth token (or Personal Access Token):',
      mask: '*'
    });

    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. Obtain the 5 most recent workouts
    console.log('\nFetching recent workouts...');
    const workoutResponse = await axios.get(`${OURA_BASE_URL}/workout`, { 
      headers: authHeaders 
    });

    // Sort by date descending and take the 5 most recent
    const workouts = workoutResponse.data.data
      .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime))
      .slice(0, 5);

    if (workouts.length === 0) {
      console.log('No workouts found in your Oura account.');
      return;
    }

    // 3. Prompt user to select a workout
    const selectedWorkout = await select({
      message: 'Select a workout to export:',
      choices: workouts.map((w) => ({
        name: `${w.activity.toUpperCase()} - ${new Date(w.start_datetime).toLocaleString()} (ID: ${w.id.substring(0, 8)}...)`,
        value: w
      }))
    });

    // 4. Obtain heart rate data for the selected workout timeframe
    console.log(`\nFetching heart rate data for: ${selectedWorkout.activity}...`);
    const hrResponse = await axios.get(`${OURA_BASE_URL}/heartrate`, {
      headers: authHeaders,
      params: {
        start_datetime: selectedWorkout.start_datetime,
        end_datetime: selectedWorkout.end_datetime
      }
    });

    const heartRateSamples = hrResponse.data.data;

    // 5. Construct the TCX file
    const tcxContent = generateTCX(selectedWorkout, heartRateSamples);
    
    // 6. Export to file using the requested format: oura-workout-<WORKOUT_ID>.tcx
    const filename = `oura-workout-${selectedWorkout.id}.tcx`;
    
    fs.writeFileSync(filename, tcxContent);
    
    console.log('---');
    console.log(`✅ Success! TCX file saved as: **${filename}**`);
    console.log(`📊 Data points: **${heartRateSamples.length}** heart rate samples included.`);

  } catch (error) {
    if (error.name === 'ExitPromptError') {
      console.log('\nPrompt cancelled by user.');
    } else {
      console.error('\nError:', error.response ? error.response.data : error.message);
    }
  }
}

/**
 * Builds the TCX XML structure using xmlbuilder2
 */
function generateTCX(workout, heartRateSamples) {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('TrainingCenterDatabase', {
      xmlns: 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd'
    })
      .ele('Activities')
        .ele('Activity', { Sport: 'Other' })
          .ele('Id').txt(workout.start_datetime).up()
          .ele('Lap', { StartTime: workout.start_datetime })
            .ele('TotalTimeSeconds').txt(calculateDuration(workout.start_datetime, workout.end_datetime)).up()
            .ele('DistanceMeters').txt(workout.distance || 0).up()
            .ele('Calories').txt(Math.round(workout.calories)).up()
            .ele('Intensity').txt('Active').up()
            .ele('TriggerMethod').txt('Manual').up()
            .ele('Track');

  // Add Heart Rate trackpoints
  heartRateSamples.forEach(sample => {
    root.ele('Trackpoint')
      .ele('Time').txt(sample.timestamp).up()
      .ele('HeartRateBpm')
        .ele('Value').txt(sample.bpm).up()
      .up()
    .up();
  });

  // End Lap and add the Creator tag
  root.up().up() 
    .ele('Creator', { 'xsi:type': 'Device_t' })
      .ele('Name').txt('Oura Ring').up()
    .up()
  .up() 
  .up() 
  // Add the Author tag at the root level
  .ele('Author', { 'xsi:type': 'Application_t' })
    .ele('Name').txt('matthewhuie/oura-workout-tcx').up()
  .up();

  return root.end({ prettyPrint: true });
}

function calculateDuration(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 1000);
}

run();
