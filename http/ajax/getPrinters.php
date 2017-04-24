<?php
include "config.php";

//print_r($_GET);

// Get coordinates to search within
$latA = $_GET['lata'];
$latB = $_GET['latb'];
$lngA = $_GET['lnga'];
$lngB = $_GET['lngb'];

// Build query
$sql = "SELECT name,lat,lng FROM libraries WHERE lat < ".$latA." AND lat >= ".$latB." AND lng < ".$lngA." AND lng >= ".$lngB;
//echo $sql;
$printersArr = [];
$result = sendQuery($sql);
if($result->num_rows > 0){
	while ($row = $result->fetch_assoc()){
		array_push($printersArr, [$row["name"],$row["lat"],$row["lng"]]);
	}
	//print_r($printersArr);
	echo json_encode($printersArr);
}
?>