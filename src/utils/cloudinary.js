// files we get from server from local path and then we add into cloudinary


import fs from "fs";

import { v2 as cloudinary } from "cloudinary";
import { log } from "console";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

const uploadOnCloudinary = async (localfilepath) => {
  //upload image on cloudinary
  try {
    if (!localfilepath) return null;
    const response = await cloudinary.uploader.upload(localfilepath, {
      resource_type: "auto",
    });

    //file has been upload successfully

    console.log("file is uploaded on cloudinary", response.url);
    return response;
  } catch (error) {
    fs.unlinkSync(localfilepath); //reomve the locally saved temporary file as the upload operation got failed
  }
};

export { uploadOnCloudinary };
