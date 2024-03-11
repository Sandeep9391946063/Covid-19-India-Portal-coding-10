const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const app = express()
const databasePath = path.join(__dirname, 'covid19IndiaPortal.db')

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

const ConvertStateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const ConvertDistrictDbObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function autheticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', (error, payload) => {
      if (error) {
        response.send(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const SelectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const DatabaseUser = await db.get(SelectUserQuery)
  if (DatabaseUser === undefined) {
    response.status(400)
    request.send('Invalid user')
  } else {
    const isPasswordmatched = await bcrypt.compare(
      password,
      DatabaseUser.password,
    )
    if (isPasswordmatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', autheticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state WHERE state_id = '${stateId}'`
  const statesArray = await db.all(getStatesQuery)
  response.send(
    statesArray.map(eachstate =>
      ConvertStateDbObjectToResponseObject(eachstate),
    ),
  )
})

app.get('/states/:stateId/', autheticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStatesQuery = `
        SELECT * 
        FROM
        state
        WHERE 
        state_id = ${stateId};`
  const state = await db.get(getStatesQuery)
  response.send(ConvertStateDbObjectToResponseObject(state))
})

app.get(
  '/districts/:districtId/',
  autheticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`
    const district = await db.get(getDistrictQuery)
    response.send(ConvertDistrictDbObjectToResponseObject(district))
  },
)

app.post('/districts/', autheticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const PostUserQuery = `
  INSERT INTO (district_name,state_id, cases , cured , active , deaths) 
  VALUES (
    '${districtName}',
    '${stateId}',
    '${cases}',
    '${cured}',
    '${active}',
    '${deaths}'
    );`
  await db.run(PostUserQuery)
  response.send('District Successfully Added')
})

app.delete(
  '/districts/:districtId/',
  autheticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const Deleterequestquery = `
    DELETE FROM   
    district
    WHERE 
    district_id = '${districtId}';`
    await db.run(Deleterequestquery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  autheticateToken,
  async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const {districtId} = request.params
    const UpdateDistrictQuery = `
        UPDATE
            district
        SET 
            district_name : '${districtName}',
            state_id : '${stateId}',
            cases : '${cases}',
            cured : '${cured}',
            active : '${active}',
            deadth : '${deaths}',
        WHERE 
            district_id = '${districtId}';`
    await db.run(UpdateDistrictQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  autheticateToken,
  async (request, response) => {
    const {stateId} = request.params

    const getStaticsQuery = `
        SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
        FROM
            district 
        WHERE 
            state_id = '${stateId}';`
    const stats = await db.get(getStaticsQuery)

    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
