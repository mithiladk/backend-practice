import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SchemaTypeOptions } from "mongoose";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken(); // refresh tokens needs to be saved in db

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "something went wrong while generating token");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend(here from postman)
  //validation -- not empty
  //check if user already exists,user name,email
  //check for images and avatar
  //upload them to cloudinary,avtar
  //create use object--create entry in db
  //remove password and refresh token filed from response
  // check for user creation
  //return res

  const { fullname, email, username, password } = req.body;
  console.log(req.body);

  //console.log("email", email);
  // if(fullName === ""){
  // throw new ApiError(400,"fullname is required")
  // }

  if (
    [fullname, email, username, password].some((filed) => filed?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  //console.log(existedUser);

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  //console.log(req.files);
  console.log("DB NAME:", process.env.DB_NAME);

  //this is in our local file not yet in cloudinary
  //const avatarLocalPath = req.files?.avatar[0].path //path from multer , we ve defined destination in the multer file
  //const coverImageLocalPath = req.files?.coverImage[0].path
  let avatarLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.avatar) &&
    req.files.avatar.length > 0
  ) {
    avatarLocalPath = req.files.avatar[0].path;
  }
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is req");
  }

  //upload them to cloudinary

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is req");
  }
  console.log("About to create user with:", { fullname, email, username });
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  console.log("User created successfully");
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken" //we dont need these entries so write eith -(minus)
  ); //_id is automatically added by mongoDb for each entry
  console.log("user", createdUser);
  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering user");
  }
  console.log("About to send response...");
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //get data from req.body
  //check username or email(ether one to check credentials)
  //find the user
  //if found user then password check then allow to login
  // if wrong then error  // if right password  gerneate access and refresh token
  // send these tokens thru secure cookies
  //send succes message

  const { email, username, password } = req.body;

  if (!username || !email) {
    throw new ApiError(400, "username or password is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }], //or operator finds a value either based on username or email
  }); //$ is a mongodb operator

  if (!user) {
    throw new ApiError(404, "User doesnt exist");
  }

  //User is mongodbs mongoose object, our user is small letters user our data is availabe here form db
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password not correct");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).
  select("-password -refreshtoken") // dont need these 2


  //can only be be ,modified thru servers not thru frontend
  const options = {
    httpOnly : true,
    secure: true
  }

return res
.status(200)
.cookie("accessToken",accessToken,options)
.cookie("refreshToken",refreshToken,options)
.json(
    new ApiResponse(
        200,
        {
            user:loggedInUser,accessToken,refreshToken
        },
        "user logged in successfully"
    )
)
});


const logoutUser = asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(
        req.user._id,
        {
            //$set mongodb operator 
            $set:{
                refreshToken:undefined
            }
        },
        {
            new: true
        }
    )
      const options = {
    httpOnly : true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,{},"User logged out"))
})

const refreshAccessToken = asyncHandler(async (req,res) =>{
    // we can access thru cookies
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
if(!incomingRefreshToken){
    throw new ApiError(401,"unauthorized req")
}

try {
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )
    
    const user = await User.findById(decodedToken?._id)
    
    if(!user) {
        throw new ApiError(401,"Invalid refresh token")
    }
    
    if(incomingRefreshToken !== user?.refreshToken){
    
        throw new ApiError(401," refresh token is expired or used")
    }
    const options = {
        httpOnly: true,
        secure:true
    }
    const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
        new ApiResponse(
            200,
            {accessToken,refreshToken:newRefreshToken},
            "access token refreshed"
        )
    )
} catch (error) {
    throw new ApiError(401,error?.message || "no token")
}
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body
 

 
    const user = User.findById(req.user?._id)
 const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

 if(!isPasswordCorrect) {
    throw new ApiError(400,"Invalid old password")
 }

 user.password = newPassword
 await user.save({validateBeforeSave:false})

 return res
 .status(200)
 .json(new ApiResponse(200,{},"password changed successfully"))

})


const getCurrentUser =  asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})


const updateAccountDetails = asyncHandler(async (req,res) =>{
    const {fullname,email} = req.body

    if(!fullname || !email){
        throw new ApiError(400,'All fileds reqd')
    }

   const user = User.findByIdAndUpdate(
    req.user?._id,
    {
        $set:{
            fullname,
            email
        }
    },
    {new:true}
).select("-password")

return res
.status(200)
.json(new ApiResponse(200,user,"Account details updated sucessfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path // from multer middleware


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on error")
    }
const user  = await User.findByIdAndUpdate(
    req.user?._id,
    {
        $set:{
            avatar:avatar.url
        }
    },
    {new:true}
).select("-password")

return res
.status(200)
.json(
    new ApiResponse(200,user,"coverImage updated suucessfully")
)
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path // from multer middleware


    if(!coverImageLocalPath){
        throw new ApiError(400,"CcverImage file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on error")
    }
const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
        $set:{
            coverImage:coverImage.url
        }
    },
    {new:true}
).select("-password")

return res
.status(200)
.json(
    new ApiResponse(200,user,"coverImage updated suucessfully")
)
})

export { registerUser, 
    loginUser,
    logoutUser ,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};
