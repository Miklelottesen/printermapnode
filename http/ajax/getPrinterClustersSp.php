<?php
include "config.php";

//print_r($_GET);

// Get coordinates to search within
$latA = floatval($_GET['lata']);
$latB = floatval($_GET['latb']);
$lngA = floatval($_GET['lnga']);
$lngB = floatval($_GET['lngb']);

$latTemp;
$lngTemp;

if($latA > $latB){
	$latTemp = $latA;
	$latA = $latB;
	$latB = $latTemp;
}
if($lngA > $lngB){
	$lngTemp = $lngA;
	$lngA = $lngB;
	$lngB = $lngTemp;
}

// Settings
$gridsize = 5; // Division factor for gridsize

// Value holders
$bpLat = []; // Grid breakpoints for lat
$bpLng = []; // Same, for lng
$grids = []; // To store each grid, position and count

// Build query
$sql = "CALL GetPrinterClusters(".$latA.",".$latB.",".$lngA.",".$lngB.",".$gridsize.")";
//echo $sql;
$printersArr = [];
$result = sendQuery($sql);
if($result->num_rows > 0){
	//print_r($result);
	// Store results in array
	$res = [];
	while ($row = $result->fetch_assoc()){
		array_push($res, $row);
	}
	echo json_encode($res);
/*
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
	echo json_encode($grid);*/
}
?>