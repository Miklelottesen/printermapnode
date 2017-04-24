<?php
include "config.php";

//print_r($_GET);

// Get coordinates to search within
$latA = $_GET['lata'];
$latB = $_GET['latb'];
$lngA = $_GET['lnga'];
$lngB = $_GET['lngb'];

// Settings
$gridsize = $_GET['zoom'] + 1; // Division factor for gridsize
if($gridsize < 4) $gridsize = 4;

// Value holders
$bpLat = []; // Grid breakpoints for lat
$bpLng = []; // Same, for lng
$grids = []; // To store each grid, position and count

// Build query
$sql = "CALL GetPrinterCluster(".$latA.",".$latB.",".$lngA.",".$lngB.")";
//echo $sql;
$printersArr = [];
$result = sendQuery($sql);
if($result->num_rows > 0){
	// Store results in array
	$res = [];
	while ($row = $result->fetch_assoc()){
		array_push($res, $row);
	}

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
/*
	// Adjust average positions to match closest real position
	for($i = 0; $i < count($grid); $i++){
		$closestLat = 0;
		$closestLng = 0;
		for($n = 0; $n < count($res); $n++){
			$latAvg = $grid[$i][0];
			$lngAvg = $grid[$i][1];
			$thisLat = $res[$n]['lat'];
			$thisLng = $res[$n]['lng'];
			$currentLatDiff = $closestLat - $latAvg;
			$currentLatDiff = ($currentLatDiff < 0) ? $currentLatDiff*-1 : $currentLatDiff;
			$currentLngDiff = $closestLng - $lngAvg;
			$currentLngDiff = ($currentLngDiff < 0) ? $currentLngDiff*-1 : $currentLngDiff;
			$newLatDiff = $thisLat - $latAvg;
			$newLatDiff = ($newLatDiff < 0) ? $newLatDiff*-1 : $newLatDiff;
			$newLngDiff = $thisLng - $lngAvg;
			$newLngDiff = ($newLngDiff < 0) ? $newLngDiff*-1 : $newtLngDiff;

			if(($newLatDiff + $newLngDiff) < ($currentLatDiff + $currentLngDiff)){
				$closestLat = $thisLat;
				$closestLng = $thisLng;
			}/*
			if($newLngDiff < $currentLngDiff){
				$closestLng = $thisLng;
			}*/
	/*	}
		$grid[$i][0] = $closestLat;
		$grid[$i][1] = $closestLng;
	}
*/
	
	//print_r($printersArr);
	echo json_encode($grid);
}
?>