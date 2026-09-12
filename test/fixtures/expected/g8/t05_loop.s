	.file	1 "t05_loop.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	sum
	.align	2
	.globl	sum_for
	.align	2
	.globl	count_down
	.align	2
	.globl	fill

	.text
	.text
	.ent	sum
sum:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$6,$0
	.set	noreorder
	.set	nomacro
	beq	$5,$0,$L3
	addu	$3,$5,-1
	.set	macro
	.set	reorder

	li	$5,-1			# 0xffffffff
$L4:
	lw	$2,0($4)
	addu	$4,$4,4
	addu	$3,$3,-1
	.set	noreorder
	.set	nomacro
	bne	$3,$5,$L4
	addu	$6,$6,$2
	.set	macro
	.set	reorder

$L3:
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$6
	.set	macro
	.set	reorder

	.end	sum
	.text
	.ent	sum_for
sum_for:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$3,$0
	.set	noreorder
	.set	nomacro
	blez	$5,$L8
	move	$6,$3
	.set	macro
	.set	reorder

$L10:
	lw	$2,0($4)
	addu	$3,$3,1
	addu	$6,$6,$2
	slt	$2,$3,$5
	.set	noreorder
	.set	nomacro
	bne	$2,$0,$L10
	addu	$4,$4,4
	.set	macro
	.set	reorder

$L8:
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$6
	.set	macro
	.set	reorder

	.end	sum_for
	.text
	.ent	count_down
count_down:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$2,$0
	addu	$2,$2,$4
$L17:
	addu	$4,$4,-1
	.set	noreorder
	.set	nomacro
	bgtz	$4,$L17
	addu	$2,$2,$4
	.set	macro
	.set	reorder

	.set	noreorder
	.set	nomacro
	j	$31
	subu	$2,$2,$4
	.set	macro
	.set	reorder

	.end	count_down
	.text
	.ent	fill
fill:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$L24
	move	$2,$5
	.set	macro
	.set	reorder

$L21:
	sh	$6,0($4)
	addu	$4,$4,2
	move	$2,$5
$L24:
	.set	noreorder
	.set	nomacro
	bgtz	$2,$L21
	addu	$5,$5,-1
	.set	macro
	.set	reorder

	j	$31
	.end	fill
