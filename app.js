const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: '${e.message}'`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const stateHeader = request.headers["authorization"];
  if (stateHeader !== undefined) {
    jwtToken = stateHeader.split(" ")[1];
  }
  if (stateHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "qwertyuiop", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//User Login Api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "qwertyuiop");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get state API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT 
        state_id as stateId,
        state_name as stateName,
        population 
    FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

//Get state_id API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT 
        state_id as stateId,
        state_name as stateName,
        population 
    FROM state 
    WHERE state_id = '${stateId}';`;
  const stateIdDetails = await db.get(getStateQuery);
  response.send(stateIdDetails);
});

//Post district API
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    INSERT INTO
        district(district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//Get district_id API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT 
        district_id as districtId,
        district_name as districtName,
        state_id as stateId,
        cases,
        cured,
        active,
        deaths
    FROM district 
    WHERE district_id = '${districtId}';`;
    const districtIdDetails = await db.get(getDistrictQuery);
    response.send(districtIdDetails);
  }
);

//Delete district_id API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE
    FROM district 
    WHERE district_id = '${districtId}';`;
    await db.get(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//Update district_id API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE district
    SET district_name = '${districtName}',
        state_id = '${stateId}',
        cases = '${cases}',
        cured = '${cured}',
        active = '${active}',
        deaths = '${deaths}'
    WHERE district_id = '${districtId}'; `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//Get totaldetails API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalQuery = `
    SELECT SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(active) as totalActive,
            SUM(deaths) as totalDeaths
    FROM district
    WHERE state_id = '${stateId}';`;
    const stateStats = await db.get(getTotalQuery);
    response.send(stateStats);
  }
);

module.exports = app;
