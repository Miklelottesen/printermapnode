<?php
include "config.php";

//print_r($_GET);

// Get coordinates to search within
$latA = $_GET['lata'];
$latB = $_GET['latb'];
$lngA = $_GET['lnga'];
$lngB = $_GET['lngb'];

//print_r($_GET);

// Build query
$sql = "SELECT COUNT(*) as num FROM libraries WHERE lat < ".$latA." AND lat >= ".$latB." AND lng < ".$lngA." AND lng >= ".$lngB;
//echo $sql;
//echo $sql;
$result = sendQuery($sql);
if($result->num_rows > 0){
	while ($row = $result->fetch_assoc()){
		echo $row["num"];
	}
}
?>