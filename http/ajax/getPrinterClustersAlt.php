<?php
include "config.php";

//print_r($_GET);

// Get coordinates to search within
$latA = $_GET['lata'];
$latB = $_GET['latb'];
$lngA = $_GET['lnga'];
$lngB = $_GET['lngb'];

// Settings
$gridsize = 7; // Division factor for gridsize

// Value holders
$bpLat = []; // Grid breakpoints for lat
$bpLng = []; // Same, for lng
$grids = []; // To store each grid, position and count
$sql = "";

// Setup vars for determining grid boundaries
$latStart = $latB;
$latEnd = $latA;
$lngStart = $lngB;
$lngEnd = $lngA;
$latDist = $latEnd - $latStart;
$lngDist = $lngEnd - $lngStart;
$latGridDist = $latDist / $gridsize;
$lngGridDist = $lngDist / $gridsize;

// Populate arrays with grid boundaries
for($i = 0; $i <= $gridsize; $i++){
	array_push($bpLat, $latStart + ($latGridDist * $i));
	array_push($bpLng, $lngStart + ($lngGridDist * $i));
}

for($i = 0; $i < $gridsize; $i++){
	for($n = 0; $n < $gridsize; $n++){
		$pointA = [];
		$pointB = [];
		$pointA[0] = $bpLat[$i];
		$pointB[0] = $bpLat[$i+1];
		$pointA[1] = $bpLng[$n];
		$pointB[1] = $bpLng[$n+1];
		$sql = $sql.buildQuery($pointA,$pointB);
		//echo $n." and ".$i."<br>";
	}
}
echo $sql;
$result = sendMultiQuery($sql);
echo json_encode($result);

function buildQuery($pointA,$pointB){
	$retVal = "SELECT libraries.lat, libraries.lng, COUNT(*) as count FROM libraries WHERE ";
	$retVal = $retVal."lat > ".$pointA[0]." AND ";
	$retVal = $retVal."lat < ".$pointB[0]." AND ";
	$retVal = $retVal."lng > ".$pointA[1]." AND ";
	$retVal = $retVal."lng < ".$pointB[1]." CROSS (SELECT AVG(lat) as avgLat, AVG(lng) as avgLng FROM libraries) as average ORDER BY ABS(average.avgLat - libraries.lat), ABS(average.avgLng - libraries.lng) LIMIT 1; ";
	return $retVal;
}
/*
// Build query
$sql = "SELECT lat,lng FROM libraries WHERE lat < ".$latA." AND lat >= ".$latB." AND lng < ".$lngA." AND lng >= ".$lngB;
//echo $sql;
$printersArr = [];
$result = sendQuery($sql);
if($result->num_rows > 0){
	// Store results in array
	$res = [];
	while ($row = $result->fetch_assoc()){
		array_push($res, $row);
	}

	

	

	// Calculate average latlng and amount
	for($i = 0; $i < $gridsize; $i++){
		for($m = 0; $m < $gridsize; $m++){
			$lats = [];
			$lngs = [];
			$latAvg = 0;
			$lngAvg = 0;
			$count = 0;
			for($n = 0; $n < count($res); $n++){
				$row = $res[$n];
				if($row['lat'] > $bpLat[$i] && $row['lat'] < $bpLat[$i+1] && $row['lng'] > $bpLng[$m] && $row['lng'] < $bpLng[$m+1]){
					if($row['lat'] == 0){
						$n--;
					}
					else {
						array_push($lats, floatval($row['lat']));
						array_push($lngs, floatval($row['lng']));
					}
					$count++;
				}
			}
			$latAvg = array_sum($lats)/count($lats);
			$lngAvg = array_sum($lngs)/count($lngs);
			if($count != 0)
				$grid[count($grid)] = [$latAvg,$lngAvg,$count];
		}
	}

	
	//print_r($printersArr);
	echo json_encode($grid);
}*/
?>