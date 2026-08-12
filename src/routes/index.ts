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

export default router;
