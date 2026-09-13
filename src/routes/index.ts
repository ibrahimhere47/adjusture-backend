import { Router } from "express";
import resizeRoute from "./resize.route.js";
import compressRoute from "./compress.route.js";
import convertRoute from "./convert.route.js";
import filterRoute from "./filter.route.js";
import watermarkRoute from "./watermark.route.js";
import rotateRoute from "./rotate.route.js";
import roundCornersRoute from "./roundCorners.route.js";
import addBackgroundRoute from "./addBackground.route.js";
import doodleRoute from "./doodle.route.js";
import removeBackgroundRoute from "./removeBackground.route.js";
import removeBackgroundProRoute from "./removeBackgroundPro.route.js";
import addBorderRoute from "./addBorder.route.js";
import colorCorrectRoute from "./colorCorrect.route.js";
import addTextRoute from "./addText.route.js";
import authRoute from "./auth.route.js";

import path from "path";
process.env.FONTCONFIG_PATH = path.join(process.cwd(), "public/fonts");

const router = Router();

router.use(resizeRoute);
router.use(compressRoute);
router.use(convertRoute);
router.use(filterRoute);
router.use(watermarkRoute);
router.use(rotateRoute);
router.use(roundCornersRoute);
router.use(addBackgroundRoute);
router.use(doodleRoute);
router.use(removeBackgroundRoute);
router.use(removeBackgroundProRoute);
router.use(addBorderRoute);
router.use(colorCorrectRoute);
router.use(addTextRoute);
router.use(authRoute);

export default router;
