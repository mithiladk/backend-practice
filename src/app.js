import express from 'express';
import cors from "cors"
import cookieParser from 'cookie-parser'
import userRouter from './routes/user.routes.js';

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended:true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


//routes import



//routes declaration
app.use("/api/v1/users",userRouter)

//http:localhost:8000/api/v1/users/register


app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500
    const message = err.message || "Internal Server Error"
    res.status(statusCode).json({
        success: false,
        message
    })
})

export {app}
